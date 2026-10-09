import {
  BaseNoteWithAssociations,
  FilterDefinition,
  FilterType,
  GetSummaryResponse,
  Note,
  NoteTypeCounts,
  PartialNote,
} from "@ncfritz/olympus-model";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { buildFilterExpression } from "../../../utils/filterUtil";
import { GraphQlNote, toDomainObject } from "../converters/NoteConverter";
import {
  NOTE_WITH_ASSOCIATIONS,
  NOTE_WITH_ASSOCIATIONS_WITH_NOTE_ID,
} from "../queries/notes";

type GraphQlNoteResponse = {
  minerva_notes: GraphQlNote[];
};

type GraphQlCreateNoteResponse = {
  insert_minerva_notes_one: GraphQlNote;
};

type GraphQlUpdateNoteResponse = {
  update_minerva_notes: { returning: GraphQlNote[] };
};

type GraphQlGetDeletedTimeResponse = {
  minerva_notes: { deletedTime: string | null }[];
};

type GraphQlHardDeleteNoteResponse = {
  update_minerva_notes: { affected_rows: number };
  delete_minerva_notes: { returning: GraphQlNote[] };
};

type GraphQlListNotesResponse = {
  minerva_notes: GraphQlNote[];
};

type GraphQlListNoteAssociationsResponse = {
  minerva_note_associations: { note: GraphQlNote }[];
};

type NoteStatisticsRow = { count: number; type: number };

type GraphQlGetMonthlyCountsResponse = {
  minerva_notes_type_statistics: (NoteStatisticsRow & { created: string })[];
};

type GraphQlGetHourlyCountsResponse = {
  minerva_notes_hour_statistics: (NoteStatisticsRow & { hour: string })[];
};

/** Result of DeleteNote: the first delete is soft, the second is hard. */
export type DeletedNote = { note: Note; hardDeleted: boolean };

const EMPTY_COUNTS: NoteTypeCounts = {
  note: 0,
  idea: 0,
  thought: 0,
  action: 0,
  praise: 0,
  question: 0,
  total: 0,
};

const NOTE_TYPES: (keyof NoteTypeCounts)[] = [
  "note",
  "idea",
  "thought",
  "action",
  "praise",
  "question",
];

const typeForId = (id: number): keyof NoteTypeCounts =>
  NOTE_TYPES[id] ?? "note";

/** Only the user's own notes (ADR 0028). */
const userFilter = (userId: string): FilterDefinition => ({
  name: "userId",
  type: FilterType.EQUALS,
  value: userId,
});

const notFound = (noteId: string) =>
  new NotFoundException(`Note with id ${noteId} not found`);

/**
 * Columns a change set may not touch: the note's identity and its owner.
 * Change sets arrive as Hasura column names, unchecked.
 */
const PROTECTED_COLUMNS = new Set(["id", "user_id", "userId"]);

const withoutProtectedColumns = (changes: PartialNote): PartialNote =>
  Object.fromEntries(
    Object.entries(changes).filter(
      ([column]) => !PROTECTED_COLUMNS.has(column),
    ),
  ) as PartialNote;

/**
 * Minerva notes in Hasura: every note operation's data access. Notes belong
 * to a user (ADR 0028): every method takes the caller's user ID and reads
 * and writes only that user's notes. Another user's note is not found.
 */
@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name);

  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Creates one of the user's notes, as a child of `parentId` when given,
   * which must be the user's. @throws NotFoundException
   */
  async create(
    userId: string,
    note: BaseNoteWithAssociations,
    parentId?: string,
  ): Promise<Note> {
    if (parentId !== undefined) {
      await this.requireOwn(userId, parentId);
    }

    const request = gql`
      mutation CreateNote(
        $userId: uuid!
        $flagged: Boolean!
        $type: numeric!
        $value: String!
        $title: String
        $summary: String
        $parentId: uuid
        $associations: [minerva_note_associations_insert_input!]!
      ) {
        insert_minerva_notes_one(
          object: {
            userId: $userId
            flagged: $flagged
            type: $type
            value: $value
            title: $title
            summary: $summary
            parent_id: $parentId
            associatedItems: {
              on_conflict: { constraint: note_associations_pkey }
              data: $associations
            }
          }
          on_conflict: {
            constraint: notes_pkey
            update_columns: [flagged, type, value]
          }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlCreateNoteResponse>(request, {
        userId,
        type: note.type,
        flagged: note.flagged,
        value: note.value,
        summary: note.summary,
        title: note.title,
        associations: note.associations.map((association) => ({
          ...association,
          userId,
        })),
        parentId: parentId,
      });

    return toDomainObject(response.insert_minerva_notes_one);
  }

  /** @throws NotFoundException */
  async describe(userId: string, noteId: string): Promise<Note> {
    const request = gql`
      query DescribeNote($id: uuid!, $userId: uuid!) {
        minerva_notes(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response = await this.graphQLClient.request<GraphQlNoteResponse>(
      request,
      { id: noteId, userId },
    );

    const found = response.minerva_notes[0];
    if (!found) throw notFound(noteId);
    return toDomainObject(found);
  }

  /** Applies `changes` (Hasura column names) to a note. @throws NotFoundException */
  async update(
    userId: string,
    noteId: string,
    changes: PartialNote,
  ): Promise<Note> {
    const request = gql`
      mutation UpdateNote(
        $id: uuid!
        $userId: uuid!
        $changes: minerva_notes_set_input = {}
      ) {
        update_minerva_notes(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          _set: $changes
        ) {
          returning {
            ${NOTE_WITH_ASSOCIATIONS}
          }
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlUpdateNoteResponse>(request, {
        id: noteId,
        userId,
        changes: withoutProtectedColumns(changes),
      });

    const updated = response.update_minerva_notes.returning[0];
    if (!updated) throw notFound(noteId);
    return toDomainObject(updated);
  }

  /**
   * Soft-deletes a note; deleting a soft-deleted note removes it and
   * detaches its children. @throws NotFoundException
   */
  async delete(userId: string, noteId: string): Promise<DeletedNote> {
    const getDeletedTimeRequest = gql`
      query GetDeletedTime($id: uuid!, $userId: uuid!) {
        minerva_notes(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          limit: 1
        ) {
          deletedTime
        }
      }
    `;

    const current =
      await this.graphQLClient.request<GraphQlGetDeletedTimeResponse>(
        getDeletedTimeRequest,
        { id: noteId, userId },
      );

    const found = current.minerva_notes[0];
    if (!found) throw notFound(noteId);

    this.logger.debug(`Note ${noteId} deletedTime: ${found.deletedTime}`);

    if (found.deletedTime === null) {
      const softDeleteRequest = gql`
        mutation SoftDeleteNote(
          $id: uuid!
          $userId: uuid!
          $timestamp: timestamptz!
        ) {
          update_minerva_notes(
            where: { id: { _eq: $id }, userId: { _eq: $userId } }
            _set: { deletedTime: $timestamp }
          ) {
            returning {
              ${NOTE_WITH_ASSOCIATIONS}
            }
          }
        }
      `;

      const response =
        await this.graphQLClient.request<GraphQlUpdateNoteResponse>(
          softDeleteRequest,
          { id: noteId, userId, timestamp: moment.utc() },
        );

      const softDeleted = response.update_minerva_notes.returning[0];
      if (!softDeleted) throw notFound(noteId);
      return {
        note: toDomainObject(softDeleted),
        hardDeleted: false,
      };
    }

    const hardDeleteRequest = gql`
      mutation HardDeleteNote($id: uuid!, $userId: uuid!) {
        update_minerva_notes(
          where: { parent_id: { _eq: $id }, userId: { _eq: $userId } }
          _set: { parent_id: null }
        ) {
          affected_rows
        }
        delete_minerva_notes(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
        ) {
          returning {
            ${NOTE_WITH_ASSOCIATIONS}
          }
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlHardDeleteNoteResponse>(
        hardDeleteRequest,
        { id: noteId, userId },
      );

    this.logger.log(
      `Disassociated ${response.update_minerva_notes.affected_rows} child notes.`,
    );

    const hardDeleted = response.delete_minerva_notes.returning[0];
    if (!hardDeleted) throw notFound(noteId);
    return {
      note: toDomainObject(hardDeleted),
      hardDeleted: true,
    };
  }

  /** Clears a note's soft delete. @throws NotFoundException */
  async restore(userId: string, noteId: string): Promise<Note> {
    const request = gql`
      mutation RestoreNote($id: uuid!, $userId: uuid!) {
        update_minerva_notes(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          _set: { deletedTime: null }
        ) {
          returning {
            ${NOTE_WITH_ASSOCIATIONS}
          }
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlUpdateNoteResponse>(request, {
        id: noteId,
        userId,
      });

    const restored = response.update_minerva_notes.returning[0];
    if (!restored) throw notFound(noteId);
    return toDomainObject(restored);
  }

  /** The children of a note, newest first. */
  async listChildren(userId: string, noteId: string): Promise<Note[]> {
    const whereExpression = buildFilterExpression({
      name: "_",
      type: FilterType.AND,
      value: [
        userFilter(userId),
        { name: "parent_id", type: FilterType.EQUALS, value: noteId },
      ],
    });

    const request = gql`
      query ListChildNotes {
        minerva_notes(
          ${whereExpression},
          order_by: { createdTime: desc }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlListNotesResponse>(request);
    return response.minerva_notes.map(toDomainObject);
  }

  /** Top-level notes created in [start, start + days), newest first. */
  async listForDays(
    userId: string,
    start: string,
    days: number,
  ): Promise<Note[]> {
    const startTime = moment(start).utc();
    const endTime = moment(startTime).add({ days: days });

    const whereExpression = buildFilterExpression({
      name: "_",
      type: FilterType.AND,
      value: [
        userFilter(userId),
        {
          name: "_",
          type: FilterType.AND,
          value: [
            {
              name: "createdTime",
              type: FilterType.GREATER_THAN_EQUAL,
              value: startTime.toISOString(),
            },
            {
              name: "createdTime",
              type: FilterType.LESS_THAN,
              value: endTime.toISOString(),
            },
          ],
        },
        { name: "parent_id", type: FilterType.IS_NULL, value: true },
      ],
    });

    const request = gql`
      query ListNotesForDay {
        minerva_notes(
          ${whereExpression},
          order_by: { createdTime: desc }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlListNotesResponse>(request);
    return response.minerva_notes.map(toDomainObject);
  }

  /** Notes associated with an entity, newest association first. */
  async listForEntity(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<Note[]> {
    const request = gql`
      query GetNotesForEntity(
        $entityId: String!
        $entityType: String!
        $userId: uuid!
      ) {
        minerva_note_associations(
          where: {
            _and: {
              itemId: { _eq: $entityId }
              itemType: { _eq: $entityType }
              userId: { _eq: $userId }
            }
          }
          order_by: { createdTime: desc }
        ) {
          note {
            ${NOTE_WITH_ASSOCIATIONS_WITH_NOTE_ID}
          }
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlListNoteAssociationsResponse>(
        request,
        { entityType, entityId, userId },
      );
    return response.minerva_note_associations.map((association) =>
      toDomainObject(association.note),
    );
  }

  /**
   * Note counts by type for each day in [end - days, end] and for each hour
   * of the day, in time zone `tz`.
   */
  async getSummary(
    userId: string,
    end: string,
    days: number,
    tz: string,
  ): Promise<GetSummaryResponse> {
    const endDate = moment(end);
    const startDate = moment(endDate).subtract({ days: days });
    const variables = {
      userId,
      start: startDate,
      end: endDate,
      tz: tz,
    };

    const counts: Record<string, NoteTypeCounts> = {};
    const hourly: Record<string, NoteTypeCounts> = {};

    for (
      let m = moment(endDate), i = 0;
      i <= days;
      m.subtract(1, "days"), i++
    ) {
      counts[m.format("YYYY-MM-DD")] = { ...EMPTY_COUNTS };
    }

    for (let i = 1; i <= 24; i++) {
      hourly[i.toString().padStart(2, "0")] = { ...EMPTY_COUNTS };
    }

    const monthlyRequest = gql`
      query GetMonthlyCounts(
        $userId: uuid!
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes_type_statistics(
          args: {
            for_user: $userId
            start_date: $start
            end_date: $end
            tz: $tz
          }
        ) {
          created
          count
          type
        }
      }
    `;

    const monthly =
      await this.graphQLClient.request<GraphQlGetMonthlyCountsResponse>(
        monthlyRequest,
        variables,
      );

    monthly.minerva_notes_type_statistics.forEach((entry) => {
      counts[entry.created][typeForId(entry.type)] += entry.count;
      counts[entry.created]["total"] += entry.count;
    });

    const hourlyRequest = gql`
      query GetHourlyCounts(
        $userId: uuid!
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes_hour_statistics(
          args: {
            for_user: $userId
            start_date: $start
            end_date: $end
            tz: $tz
          }
        ) {
          count
          hour
          type
        }
      }
    `;

    const hourlyResponse =
      await this.graphQLClient.request<GraphQlGetHourlyCountsResponse>(
        hourlyRequest,
        variables,
      );

    hourlyResponse.minerva_notes_hour_statistics.forEach((entry) => {
      hourly[entry.hour][typeForId(entry.type)] += entry.count;
      hourly[entry.hour]["total"] += entry.count;
    });

    return { counts, hourly };
  }

  /** @throws NotFoundException unless `noteId` is one of the user's notes. */
  private async requireOwn(userId: string, noteId: string): Promise<void> {
    const request = gql`
      query GetOwnNote($id: uuid!, $userId: uuid!) {
        minerva_notes(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          limit: 1
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_notes: { id: string }[];
    }>(request, { id: noteId, userId });
    if (response.minerva_notes.length === 0) throw notFound(noteId);
  }
}
