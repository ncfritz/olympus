import {
  type AvailabilityBlock,
  type AvailabilityLevel,
  clearMeetingAvailability,
  client,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  getAvailability,
  listAvailabilityBlocks,
  listMeetingAvailabilities,
  type MeetingAvailability,
  setMeetingAvailability,
  updateAvailabilityBlock,
} from "@ncfritz/olympus-sdk/minerva";
import { inGroups } from "../utils/meetingAvailability";
import { drawerRange, type OnAirEvents, toOnAirEvents } from "../utils/onair";

const errorStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

/**
 * The signed-in user's availability through the API (ADR 0029), for the
 * OnAir drawer and the header's ON AIR button. The working day is read in
 * the browser's time zone.
 */
class AvailabilityApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  private get tz() {
    return {
      headers: {
        "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  /** The level now. */
  async current(): Promise<AvailabilityLevel | undefined> {
    const now = new Date();
    const { data } = await getAvailability({
      query: {
        start: now.toISOString(),
        end: new Date(now.getTime() + 60 * 1000).toISOString(),
      },
      ...this.tz,
    });
    return data.availability.slots[0]?.status;
  }

  /** What the drawer's calendar shows, over the days it can show. */
  async events(): Promise<OnAirEvents> {
    const { data } = await getAvailability({
      query: drawerRange(new Date()),
      ...this.tz,
    });
    return toOnAirEvents(data.availability);
  }

  /**
   * Saves a block: changes it if it is there, else creates it. The drawer
   * names a new block with an ID of its own making, which the API replaces.
   */
  async saveBlock(
    blockId: string,
    status: AvailabilityLevel,
    start: Date,
    end: Date,
  ): Promise<void> {
    const block = {
      status,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
    try {
      await updateAvailabilityBlock({ path: { blockId }, body: { block } });
    } catch (error) {
      if (errorStatus(error) !== 404) throw error;
      await createAvailabilityBlock({ body: { block } });
    }
  }

  /** The blocks that overlap a range. */
  async listBlocks(start: Date, end: Date): Promise<AvailabilityBlock[]> {
    const { data } = await listAvailabilityBlocks({
      query: { start: start.toISOString(), end: end.toISOString() },
    });
    return data.blocks;
  }

  /** A new block, as the API made it. */
  async createBlock(
    status: AvailabilityLevel,
    start: Date,
    end: Date,
  ): Promise<AvailabilityBlock> {
    const { data } = await createAvailabilityBlock({
      body: {
        block: {
          status,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      },
    });
    return data.block;
  }

  /** Changes a block's status, or where it is. */
  async updateBlock(
    blockId: string,
    change: { status?: AvailabilityLevel; start?: Date; end?: Date },
  ): Promise<void> {
    await updateAvailabilityBlock({
      path: { blockId },
      body: {
        block: {
          status: change.status,
          startTime: change.start?.toISOString(),
          endTime: change.end?.toISOString(),
        },
      },
    });
  }

  /**
   * The availability of these meetings: each one's status, and whether it
   * is overridden. Asked for in groups the API takes; meetings that aren't
   * the caller's are left out.
   */
  async listMeetings(meetingIds: string[]): Promise<MeetingAvailability[]> {
    const groups = await Promise.all(
      inGroups(meetingIds).map(async (group) => {
        const { data } = await listMeetingAvailabilities({
          query: { meetingIds: group.join(",") },
        });
        return data.meetings;
      }),
    );
    return groups.flat();
  }

  async deleteBlock(blockId: string): Promise<void> {
    await deleteAvailabilityBlock({ path: { blockId } });
  }

  async setMeetingLevel(
    meetingId: string,
    status: AvailabilityLevel,
  ): Promise<void> {
    await setMeetingAvailability({
      path: { meetingId },
      body: { availability: { status } },
    });
  }

  async clearMeetingLevel(meetingId: string): Promise<void> {
    await clearMeetingAvailability({ path: { meetingId } });
  }
}

const availabilityApi = new AvailabilityApi();
export default availabilityApi;
