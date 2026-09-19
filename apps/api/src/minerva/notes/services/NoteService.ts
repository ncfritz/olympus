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

type GraphQlNoteByPkResponse = {
  minerva_notes_by_pk: GraphQlNote | null;
};

type GraphQlCreateNoteResponse = {
  insert_minerva_notes_one: GraphQlNote;
};

type GraphQlUpdateNoteResponse = {
  update_minerva_notes_by_pk: GraphQlNote | null;
};

type GraphQlGetDeletedTimeResponse = {
  minerva_notes_by_pk: { deletedTime: string | null } | null;
};

type GraphQlHardDeleteNoteResponse = {
  update_minerva_notes: { affected_rows: number };
  delete_minerva_notes_by_pk: GraphQlNote;
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

// Notes are single-user for now.
const AUTHOR_FILTER: FilterDefinition = {
  name: "author",
  type: FilterType.EQUALS,
  value: "ncfritz",
};

const notFound = (noteId: string) =>
  new NotFoundException(`Note with id ${noteId} not found`);

/** Minerva notes in Hasura: every note operation's data access. */
@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name);

  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates a note, as a child of `parentId` when given. */
  async create(
    note: BaseNoteWithAssociations,
    parentId?: string,
  ): Promise<Note> {
    const request = gql`
      mutation CreateNote(
        $author: String!
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
            author: $author
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
        author: note.author,
        type: note.type,
        flagged: note.flagged,
        value: note.value,
        summary: note.summary,
        title: note.title,
        associations: note.associations,
        parentId: parentId,
      });

    return toDomainObject(response.insert_minerva_notes_one);
  }

  /** @throws NotFoundException */
  async describe(noteId: string): Promise<Note> {
    const request = gql`
      query DescribeNote($id: uuid!) {
        minerva_notes_by_pk(id: $id) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response = await this.graphQLClient.request<GraphQlNoteByPkResponse>(
      request,
      { id: noteId },
    );

    if (!response.minerva_notes_by_pk) throw notFound(noteId);
    return toDomainObject(response.minerva_notes_by_pk);
  }

  /** Applies `changes` (Hasura column names) to a note. @throws NotFoundException */
  async update(noteId: string, changes: PartialNote): Promise<Note> {
    const request = gql`
      mutation UpdateNote($id: uuid!, $changes: minerva_notes_set_input = {}) {
        update_minerva_notes_by_pk(pk_columns: { id: $id }, _set: $changes) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlUpdateNoteResponse>(request, {
        id: noteId,
        changes,
      });

    if (!response.update_minerva_notes_by_pk) throw notFound(noteId);
    return toDomainObject(response.update_minerva_notes_by_pk);
  }

  /**
   * Soft-deletes a note; deleting a soft-deleted note removes it and
   * detaches its children. @throws NotFoundException
   */
  async delete(noteId: string): Promise<DeletedNote> {
    const getDeletedTimeRequest = gql`
      query GetDeletedTime($id: uuid!) {
        minerva_notes_by_pk(id: $id) {
          deletedTime
        }
      }
    `;

    const current =
      await this.graphQLClient.request<GraphQlGetDeletedTimeResponse>(
        getDeletedTimeRequest,
        { id: noteId },
      );

    if (!current.minerva_notes_by_pk) throw notFound(noteId);

    this.logger.debug(
      `Note ${noteId} deletedTime: ${current.minerva_notes_by_pk.deletedTime}`,
    );

    if (current.minerva_notes_by_pk.deletedTime === null) {
      const softDeleteRequest = gql`
        mutation SoftDeleteNote($id: uuid!, $timestamp: timestamptz!) {
          update_minerva_notes_by_pk(
            pk_columns: { id: $id }
            _set: { deletedTime: $timestamp }
          ) {
            ${NOTE_WITH_ASSOCIATIONS}
          }
        }
      `;

      const response =
        await this.graphQLClient.request<GraphQlUpdateNoteResponse>(
          softDeleteRequest,
          { id: noteId, timestamp: moment.utc() },
        );

      if (!response.update_minerva_notes_by_pk) throw notFound(noteId);
      return {
        note: toDomainObject(response.update_minerva_notes_by_pk),
        hardDeleted: false,
      };
    }

    const hardDeleteRequest = gql`
      mutation HardDeleteNote($id: uuid!) {
        update_minerva_notes(where: {parent_id: {_eq: $id}}, _set: {parent_id: null}) {
          affected_rows
        }
        delete_minerva_notes_by_pk(id: $id) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlHardDeleteNoteResponse>(
        hardDeleteRequest,
        { id: noteId },
      );

    this.logger.log(
      `Disassociated ${response.update_minerva_notes.affected_rows} child notes.`,
    );

    return {
      note: toDomainObject(response.delete_minerva_notes_by_pk),
      hardDeleted: true,
    };
  }

  /** Clears a note's soft delete. @throws NotFoundException */
  async restore(noteId: string): Promise<Note> {
    const request = gql`
      mutation RestoreNote($id: uuid!) {
        update_minerva_notes_by_pk(
          pk_columns: { id: $id }
          _set: { deletedTime: null }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const response =
      await this.graphQLClient.request<GraphQlUpdateNoteResponse>(request, {
        id: noteId,
      });

    if (!response.update_minerva_notes_by_pk) throw notFound(noteId);
    return toDomainObject(response.update_minerva_notes_by_pk);
  }

  /** The children of a note, newest first. */
  async listChildren(noteId: string): Promise<Note[]> {
    const whereExpression = buildFilterExpression({
      name: "_",
      type: FilterType.AND,
      value: [
        AUTHOR_FILTER,
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
  async listForDays(start: string, days: number): Promise<Note[]> {
    const startTime = moment(start).utc();
    const endTime = moment(startTime).add({ days: days });

    const whereExpression = buildFilterExpression({
      name: "_",
      type: FilterType.AND,
      value: [
        AUTHOR_FILTER,
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
  async listForEntity(entityType: string, entityId: string): Promise<Note[]> {
    const request = gql`
      query GetNotesForEntity($entityId: String!, $entityType: String!) {
        minerva_note_associations(
          where: {
            _and: { itemId: { _eq: $entityId }, itemType: { _eq: $entityType } }
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
        { entityType, entityId },
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
    end: string,
    days: number,
    tz: string,
  ): Promise<GetSummaryResponse> {
    const endDate = moment(end);
    const startDate = moment(endDate).subtract({ days: days });
    const variables = { start: startDate, end: endDate, tz: tz };

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
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes_type_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
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
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes_hour_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
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
}
