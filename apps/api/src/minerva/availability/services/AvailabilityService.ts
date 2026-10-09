import type {
  Availability,
  AvailabilityBlock,
  AvailabilityLevel,
  BaseAvailabilityBlock,
  MeetingAvailability,
  PartialAvailabilityBlock,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { CalendarService } from "../../calendars/services/CalendarService";
import { checkOptionalText } from "../../utils/validation";
import {
  type GraphQlAvailabilityBlock,
  type GraphQlAvailabilityMeeting,
  toAvailabilityBlock,
  toMeetingAvailability,
} from "../converters/AvailabilityConverter";
import {
  AVAILABILITY_BLOCK,
  AVAILABILITY_MEETING,
} from "../queries/availability";
import {
  availabilitySlots,
  DEFAULT_WORKING_DAY,
  isLevel,
  isTimeZone,
  MAX_RANGE_MS,
  parseTimeOfDay,
  SLOT_MS,
  slotStartOf,
  type WorkingDay,
} from "../utils/availabilityRules";

/** The working day as the caller names it; anything absent is the default. */
export type WorkingDayParams = {
  timezone?: string;
  dayStart?: string;
  dayEnd?: string;
  includeWeekends?: string;
};

type Range = { start: number; end: number };

const LABEL_MAX = 200;

/** How many meetings one ListMeetingAvailabilities may name. */
export const MEETING_IDS_MAX = 500;

const blockNotFound = (blockId: string) =>
  new NotFoundException(`Availability block with id ${blockId} not found`);

const meetingNotFound = (meetingId: string) =>
  new NotFoundException(`Calendar Item with id ${meetingId} not found`);

/** An ISO-8601 timestamp as epoch milliseconds, or undefined. */
const parseTimestamp = (value: unknown): number | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = moment(value, moment.ISO_8601, true);
  return parsed.isValid() ? parsed.valueOf() : undefined;
};

const iso = (epochMs: number) => new Date(epochMs).toISOString();

/** The level to check, `name` naming it in the problem. */
const checkLevel = (
  value: unknown,
  name: string,
  problems: string[],
): AvailabilityLevel => {
  if (!isLevel(value)) {
    problems.push(`${name} must be one of none, free, interruptable, busy`);
  }
  return value as AvailabilityLevel;
};

/**
 * A user's availability (ADR 0029): worked out from their own meetings,
 * with the blocks and meeting levels they set on top. Every method takes
 * the caller's user ID and reads and writes only that user's rows; another
 * user's block is not found.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly calendars: CalendarService,
  ) {}

  /**
   * The user's availability from `start` to `end`: every 15-minute slot
   * (the range widened to whole slots), with the meetings and blocks in it.
   * @throws BadRequestException
   */
  async get(
    userId: string,
    start: unknown,
    end: unknown,
    params: WorkingDayParams,
  ): Promise<Availability> {
    const problems: string[] = [];
    const range = checkRange(start, end, problems);
    const day = checkWorkingDay(params, problems);
    if (problems.length || !range || !day) {
      throw new BadRequestException(problems);
    }
    const from = slotStartOf(range.start);
    const to = Math.ceil(range.end / SLOT_MS) * SLOT_MS;

    const query = gql`
      query GetAvailability(
        $userId: uuid!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meetings(
          where: {
            user_id: { _eq: $userId }
            start_time: { _lt: $end }
            end_time: { _gt: $start }
            cancelled: { _eq: false }
            _or: [{ deleted: { _eq: false } }, { deleted: { _is_null: true } }]
          }
          order_by: [{ start_time: asc }, { id: asc }]
        ) {
          ${AVAILABILITY_MEETING}
        }
        minerva_availability_blocks(
          where: {
            userId: { _eq: $userId }
            startTime: { _lt: $end }
            endTime: { _gt: $start }
          }
          order_by: [{ startTime: asc }, { id: asc }]
        ) {
          ${AVAILABILITY_BLOCK}
        }
      }
    `;
    const [response, excluded] = await Promise.all([
      this.graphQLClient.request<{
        minerva_meetings: GraphQlAvailabilityMeeting[];
        minerva_availability_blocks: GraphQlAvailabilityBlock[];
      }>(query, { userId, start: iso(from), end: iso(to) }),
      this.calendars.excludedFromBusy(userId),
    ]);
    const overrides = await this.meetingLevels(
      userId,
      response.minerva_meetings.map((m) => m.id),
    );

    const meetings = response.minerva_meetings.map((m) =>
      toMeetingAvailability(m, overrides.get(m.id), excluded),
    );
    const blocks =
      response.minerva_availability_blocks.map(toAvailabilityBlock);
    const slots = availabilitySlots(
      from,
      to,
      meetings
        .filter((m) => m.counted)
        .map((m) => ({
          start: m.startTime.valueOf(),
          end: m.endTime.valueOf(),
          level: m.status,
          overridden: m.overridden,
        })),
      blocks.map((b) => ({
        start: b.startTime.valueOf(),
        end: b.endTime.valueOf(),
        level: b.status,
      })),
      day,
    );

    return {
      startTime: moment.utc(from),
      endTime: moment.utc(to),
      slots: slots.map((s) => ({
        startTime: moment.utc(s.start),
        status: s.level,
      })),
      meetings,
      blocks,
    };
  }

  /** The user's blocks overlapping `start` to `end`. @throws BadRequestException */
  async listBlocks(
    userId: string,
    start: unknown,
    end: unknown,
  ): Promise<AvailabilityBlock[]> {
    const problems: string[] = [];
    const range = checkRange(start, end, problems);
    if (problems.length || !range) throw new BadRequestException(problems);

    const query = gql`
      query ListAvailabilityBlocks(
        $userId: uuid!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_availability_blocks(
          where: {
            userId: { _eq: $userId }
            startTime: { _lt: $end }
            endTime: { _gt: $start }
          }
          order_by: [{ startTime: asc }, { id: asc }]
        ) {
          ${AVAILABILITY_BLOCK}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_availability_blocks: GraphQlAvailabilityBlock[];
    }>(query, { userId, start: iso(range.start), end: iso(range.end) });
    return response.minerva_availability_blocks.map(toAvailabilityBlock);
  }

  /** @throws NotFoundException */
  async describeBlock(
    userId: string,
    blockId: string,
  ): Promise<AvailabilityBlock> {
    return toAvailabilityBlock(await this.requireBlock(userId, blockId));
  }

  /** @throws BadRequestException */
  async createBlock(
    userId: string,
    block: BaseAvailabilityBlock | undefined,
  ): Promise<AvailabilityBlock> {
    const problems: string[] = [];
    const input = (block ?? {}) as Record<string, unknown>;
    const start = parseTimestamp(input.startTime);
    const end = parseTimestamp(input.endTime);
    if (start === undefined) problems.push("startTime must be a timestamp");
    if (end === undefined) problems.push("endTime must be a timestamp");
    if (start !== undefined && end !== undefined && end <= start) {
      problems.push("endTime must be after startTime");
    }
    const status = checkLevel(input.status, "status", problems);
    const label = checkOptionalText(input.label, "label", LABEL_MAX, problems);
    if (problems.length) throw new BadRequestException(problems);

    const mutation = gql`
      mutation CreateAvailabilityBlock(
        $block: minerva_availability_blocks_insert_input!
      ) {
        insert_minerva_availability_blocks_one(object: $block) {
          ${AVAILABILITY_BLOCK}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      insert_minerva_availability_blocks_one: GraphQlAvailabilityBlock;
    }>(mutation, {
      block: {
        userId,
        startTime: iso(start!),
        endTime: iso(end!),
        status,
        label,
      },
    });
    return toAvailabilityBlock(response.insert_minerva_availability_blocks_one);
  }

  /**
   * Changes one of the user's blocks; what the request leaves out stays.
   * @throws NotFoundException, BadRequestException
   */
  async updateBlock(
    userId: string,
    blockId: string,
    changes: PartialAvailabilityBlock,
  ): Promise<AvailabilityBlock> {
    const problems: string[] = [];
    const input = changes as Record<string, unknown>;
    const set: Record<string, unknown> = {};
    let start: number | undefined;
    let end: number | undefined;
    if (input.startTime !== undefined) {
      start = parseTimestamp(input.startTime);
      if (start === undefined) problems.push("startTime must be a timestamp");
      else set.startTime = iso(start);
    }
    if (input.endTime !== undefined) {
      end = parseTimestamp(input.endTime);
      if (end === undefined) problems.push("endTime must be a timestamp");
      else set.endTime = iso(end);
    }
    if (input.status !== undefined) {
      set.status = checkLevel(input.status, "status", problems);
    }
    if (input.label !== undefined) {
      set.label = checkOptionalText(input.label, "label", LABEL_MAX, problems);
    }
    if (problems.length) throw new BadRequestException(problems);

    const current = await this.requireBlock(userId, blockId);
    const newStart = start ?? Date.parse(current.startTime);
    const newEnd = end ?? Date.parse(current.endTime);
    if (newEnd <= newStart) {
      throw new BadRequestException(["endTime must be after startTime"]);
    }

    const mutation = gql`
      mutation UpdateAvailabilityBlock(
        $id: uuid!
        $userId: uuid!
        $set: minerva_availability_blocks_set_input!
      ) {
        update_minerva_availability_blocks(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${AVAILABILITY_BLOCK}
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_availability_blocks: {
        returning: GraphQlAvailabilityBlock[];
      };
    }>(mutation, { id: blockId, userId, set });
    const updated = response.update_minerva_availability_blocks.returning[0];
    if (!updated) throw blockNotFound(blockId);
    return toAvailabilityBlock(updated);
  }

  /** @throws NotFoundException */
  async deleteBlock(userId: string, blockId: string): Promise<void> {
    const mutation = gql`
      mutation DeleteAvailabilityBlock($id: uuid!, $userId: uuid!) {
        delete_minerva_availability_blocks(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      delete_minerva_availability_blocks: { affected_rows: number };
    }>(mutation, { id: blockId, userId });
    if (!response.delete_minerva_availability_blocks.affected_rows) {
      throw blockNotFound(blockId);
    }
  }

  /**
   * Sets the level one of the user's meetings counts for, whatever its
   * calendar says. @throws NotFoundException, BadRequestException
   */
  async setMeetingLevel(
    userId: string,
    meetingId: string,
    status: unknown,
  ): Promise<MeetingAvailability> {
    const problems: string[] = [];
    const level = checkLevel(status, "status", problems);
    if (problems.length) throw new BadRequestException(problems);

    const meeting = await this.requireMeeting(userId, meetingId);
    const mutation = gql`
      mutation SetMeetingAvailability(
        $availability: minerva_meeting_availability_insert_input!
      ) {
        insert_minerva_meeting_availability_one(
          object: $availability
          on_conflict: {
            constraint: meeting_availability_pkey
            update_columns: [status]
          }
        ) {
          meetingId
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      availability: { userId, meetingId, status: level },
    });
    const excluded = await this.calendars.excludedFromBusy(userId);
    return toMeetingAvailability(meeting, level, excluded);
  }

  /**
   * These meetings of the user's, each with the level it counts for, in
   * the order asked. An ID that is not one of the user's meetings is left
   * out rather than refused: whose a meeting is, is not the caller's to
   * learn. @throws BadRequestException
   */
  async listMeetings(
    userId: string,
    meetingIds: unknown,
  ): Promise<MeetingAvailability[]> {
    const ids =
      typeof meetingIds === "string"
        ? [
            ...new Set(
              meetingIds
                .split(",")
                .map((id) => id.trim())
                .filter((id) => id !== ""),
            ),
          ]
        : [];
    if (!ids.length) {
      throw new BadRequestException(["meetingIds must name a meeting"]);
    }
    if (ids.length > MEETING_IDS_MAX) {
      throw new BadRequestException([
        `meetingIds must name at most ${MEETING_IDS_MAX} meetings`,
      ]);
    }

    const query = gql`
      query ListMeetingsForAvailability($ids: [String!]!, $userId: uuid!) {
        minerva_meetings(
          where: { id: { _in: $ids }, user_id: { _eq: $userId } }
        ) {
          ${AVAILABILITY_MEETING}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_meetings: GraphQlAvailabilityMeeting[];
    }>(query, { ids, userId });
    const found = new Map(response.minerva_meetings.map((m) => [m.id, m]));
    const mine = ids.filter((id) => found.has(id));
    if (!mine.length) return [];

    const [levels, excluded] = await Promise.all([
      this.meetingLevels(userId, mine),
      this.calendars.excludedFromBusy(userId),
    ]);
    return mine.map((id) =>
      toMeetingAvailability(found.get(id)!, levels.get(id), excluded),
    );
  }

  /**
   * Goes back to the level the meeting's calendar status gives. Idempotent:
   * the level outlives its meeting (ADR 0029), so it can be cleared after.
   */
  async clearMeetingLevel(userId: string, meetingId: string): Promise<void> {
    const mutation = gql`
      mutation ClearMeetingAvailability($userId: uuid!, $meetingId: String!) {
        delete_minerva_meeting_availability(
          where: { userId: { _eq: $userId }, meetingId: { _eq: $meetingId } }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, { userId, meetingId });
  }

  /** The levels the user set for these meetings, by meeting ID. */
  private async meetingLevels(
    userId: string,
    meetingIds: string[],
  ): Promise<Map<string, AvailabilityLevel>> {
    if (!meetingIds.length) return new Map();
    const query = gql`
      query ListMeetingAvailability($userId: uuid!, $meetingIds: [String!]!) {
        minerva_meeting_availability(
          where: { userId: { _eq: $userId }, meetingId: { _in: $meetingIds } }
        ) {
          meetingId
          status
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_meeting_availability: { meetingId: string; status: string }[];
    }>(query, { userId, meetingIds });
    return new Map(
      response.minerva_meeting_availability
        .filter((row) => isLevel(row.status))
        .map((row) => [row.meetingId, row.status as AvailabilityLevel]),
    );
  }

  private async requireBlock(
    userId: string,
    blockId: string,
  ): Promise<GraphQlAvailabilityBlock> {
    const query = gql`
      query DescribeAvailabilityBlock($id: uuid!, $userId: uuid!) {
        minerva_availability_blocks(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
        ) {
          ${AVAILABILITY_BLOCK}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_availability_blocks: GraphQlAvailabilityBlock[];
    }>(query, { id: blockId, userId });
    const block = response.minerva_availability_blocks[0];
    if (!block) throw blockNotFound(blockId);
    return block;
  }

  private async requireMeeting(
    userId: string,
    meetingId: string,
  ): Promise<GraphQlAvailabilityMeeting> {
    const query = gql`
      query DescribeMeetingForAvailability($id: String!, $userId: uuid!) {
        minerva_meetings(
          where: { id: { _eq: $id }, user_id: { _eq: $userId } }
        ) {
          ${AVAILABILITY_MEETING}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_meetings: GraphQlAvailabilityMeeting[];
    }>(query, { id: meetingId, userId });
    const meeting = response.minerva_meetings[0];
    if (!meeting) throw meetingNotFound(meetingId);
    return meeting;
  }
}

/** A range of at most MAX_RANGE_MS, start before end. */
const checkRange = (
  start: unknown,
  end: unknown,
  problems: string[],
): Range | undefined => {
  const from = parseTimestamp(start);
  const to = parseTimestamp(end);
  if (from === undefined) problems.push("start must be a timestamp");
  if (to === undefined) problems.push("end must be a timestamp");
  if (from === undefined || to === undefined) return undefined;
  if (to <= from) {
    problems.push("end must be after start");
    return undefined;
  }
  if (to - from > MAX_RANGE_MS) {
    problems.push("the range must be at most 92 days");
    return undefined;
  }
  return { start: from, end: to };
};

/** The working day the caller names, defaults filling in the rest. */
const checkWorkingDay = (
  params: WorkingDayParams,
  problems: string[],
): WorkingDay | undefined => {
  const timezone = params.timezone ?? DEFAULT_WORKING_DAY.timezone;
  const startMinutes =
    params.dayStart === undefined
      ? DEFAULT_WORKING_DAY.startMinutes
      : parseTimeOfDay(params.dayStart);
  const endMinutes =
    params.dayEnd === undefined
      ? DEFAULT_WORKING_DAY.endMinutes
      : parseTimeOfDay(params.dayEnd);
  const before = problems.length;
  if (!isTimeZone(timezone)) {
    problems.push("the time zone must be an IANA name");
  }
  if (startMinutes === undefined) problems.push("dayStart must be HH:mm");
  if (endMinutes === undefined) problems.push("dayEnd must be HH:mm");
  if (
    startMinutes !== undefined &&
    endMinutes !== undefined &&
    endMinutes <= startMinutes
  ) {
    problems.push("dayEnd must be after dayStart");
  }
  const weekends = params.includeWeekends;
  if (weekends !== undefined && weekends !== "true" && weekends !== "false") {
    problems.push("includeWeekends must be true or false");
  }
  if (problems.length > before) return undefined;
  return {
    timezone,
    startMinutes: startMinutes!,
    endMinutes: endMinutes!,
    includeWeekends: weekends === "true",
  };
};
