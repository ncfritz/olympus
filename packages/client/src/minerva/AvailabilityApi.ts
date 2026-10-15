import {
  type AvailabilityLevel,
  type BaseAvailabilityBlock,
  clearMeetingAvailability,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  getAvailability,
  type PartialAvailabilityBlock,
  setMeetingAvailability,
  updateAvailabilityBlock,
} from "@ncfritz/olympus-sdk/minerva";
import type { OlympusClients } from "../clients";

/** The working day the availability is read against (ADR 0029). */
export type WorkingDay = {
  /** The caller's IANA time zone; the API reads Etc/UTC without one. */
  timeZone?: string;
  /** HH:mm in that time zone; 08:00 and 18:00 when absent. */
  dayStart?: string;
  dayEnd?: string;
  includeWeekends?: boolean;
};

/**
 * Minerva availability (ADR 0029) for the signed-in user: the OnAir app.
 * The caller is whoever the access token names, so nothing here takes a user.
 */
export class AvailabilityApi {
  constructor(private readonly clients: OlympusClients) {}

  /** 15-minute slots, meetings and blocks between `start` and `end`. */
  async getAvailability(start: Date, end: Date, day: WorkingDay = {}) {
    const { timeZone, ...hours } = day;
    const response = await getAvailability({
      client: this.clients.minerva,
      query: { start: start.toISOString(), end: end.toISOString(), ...hours },
      ...(timeZone === undefined
        ? {}
        : { headers: { "x-ncfritz-tz": timeZone } }),
    });
    return response.data.availability;
  }

  /** An override: a span of time at a level, whatever meetings fall in it. */
  async createAvailabilityBlock(block: BaseAvailabilityBlock) {
    const response = await createAvailabilityBlock({
      client: this.clients.minerva,
      body: { block },
    });
    return response.data.block;
  }

  async updateAvailabilityBlock(
    blockId: string,
    block: PartialAvailabilityBlock,
  ) {
    const response = await updateAvailabilityBlock({
      client: this.clients.minerva,
      path: { blockId },
      body: { block },
    });
    return response.data.block;
  }

  async deleteAvailabilityBlock(blockId: string) {
    await deleteAvailabilityBlock({
      client: this.clients.minerva,
      path: { blockId },
    });
  }

  /** The level a meeting counts for, whatever its calendar says. */
  async setMeetingAvailability(meetingId: string, status: AvailabilityLevel) {
    const response = await setMeetingAvailability({
      client: this.clients.minerva,
      path: { meetingId },
      body: { availability: { status } },
    });
    return response.data.meeting;
  }

  /** Back to the level the meeting's calendar status gives. */
  async clearMeetingAvailability(meetingId: string) {
    await clearMeetingAvailability({
      client: this.clients.minerva,
      path: { meetingId },
    });
  }
}
