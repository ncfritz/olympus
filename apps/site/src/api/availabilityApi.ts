import {
  type AvailabilityLevel,
  clearMeetingAvailability,
  client,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  getAvailability,
  setMeetingAvailability,
  updateAvailabilityBlock,
} from "@ncfritz/olympus-sdk/minerva";
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
