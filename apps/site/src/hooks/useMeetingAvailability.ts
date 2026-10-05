import type {
  AvailabilityBlock,
  MeetingAvailability,
} from "@ncfritz/olympus-sdk/minerva";
import { useCallback, useEffect, useMemo, useState } from "react";
import availabilityApi from "../api/availabilityApi";
import type { AvailabilityActions } from "../utils/meetingAvailability";
import { Events, publish } from "../utils/events";
import { type OnAirStatus, toLevel } from "../utils/onair";

export interface PageAvailability {
  /** Each meeting's availability, by meeting ID. */
  availabilities: Record<string, MeetingAvailability>;
  /** The override blocks over the range. */
  blocks: AvailabilityBlock[];
  actions: AvailabilityActions & {
    /** A new block over a range, with no status yet: its ID. */
    createBlock: (start: Date, end: Date) => Promise<string | undefined>;
    moveBlock: (blockId: string, start: Date, end: Date) => Promise<void>;
  };
}

const failed = (message: string) =>
  publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
    type: "error",
    message,
    description: "Please try again",
  });

/**
 * A meetings page's availability (ADR 0029): the meetings' statuses and
 * overrides, the override blocks over the range shown, and changing them.
 * Every change reloads both, so what is shown is what the API holds.
 */
const useMeetingAvailability = (
  meetingIds: string[],
  start: Date | undefined,
  end: Date | undefined,
): PageAvailability => {
  const [availabilities, setAvailabilities] = useState<
    Record<string, MeetingAvailability>
  >({});
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);

  // Keys the loads by value: the views make new arrays and dates each render.
  const idsKey = meetingIds.join("\n");
  const startKey = start?.toISOString();
  const endKey = end?.toISOString();

  const loadMeetings = useCallback(async () => {
    const ids = idsKey ? idsKey.split("\n") : [];
    if (ids.length === 0) {
      setAvailabilities({});
      return;
    }
    try {
      const meetings = await availabilityApi.listMeetings(ids);
      setAvailabilities(
        Object.fromEntries(meetings.map((m) => [m.meetingId, m])),
      );
    } catch {
      failed("Failed to load the meetings' availability");
    }
  }, [idsKey]);

  const loadBlocks = useCallback(async () => {
    if (!startKey || !endKey) return;
    try {
      setBlocks(
        await availabilityApi.listBlocks(new Date(startKey), new Date(endKey)),
      );
    } catch {
      failed("Failed to load the availability overrides");
    }
  }, [startKey, endKey]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const actions = useMemo(() => {
    const change = async (message: string, action: () => Promise<void>) => {
      try {
        await action();
      } catch {
        failed(message);
      }
      await Promise.all([loadMeetings(), loadBlocks()]);
    };

    return {
      setMeetingStatus: (meetingId: string, status: OnAirStatus) =>
        change("Failed to set the meeting's availability", () =>
          availabilityApi.setMeetingLevel(meetingId, toLevel(status)),
        ),
      removeMeetingOverride: (meetingId: string) =>
        change("Failed to remove the meeting's override", () =>
          availabilityApi.clearMeetingLevel(meetingId),
        ),
      setBlockStatus: (blockId: string, status: OnAirStatus) =>
        change("Failed to set the override's status", () =>
          availabilityApi.updateBlock(blockId, { status: toLevel(status) }),
        ),
      moveBlock: (blockId: string, start: Date, end: Date) =>
        change("Failed to move the override", () =>
          availabilityApi.updateBlock(blockId, { start, end }),
        ),
      deleteBlock: (blockId: string) =>
        change("Failed to remove the override", () =>
          availabilityApi.deleteBlock(blockId),
        ),
      createBlock: async (start: Date, end: Date) => {
        let id: string | undefined;
        await change("Failed to add the override", async () => {
          id = (await availabilityApi.createBlock("none", start, end)).id;
        });
        return id;
      },
    };
  }, [loadMeetings, loadBlocks]);

  return { availabilities, blocks, actions };
};

export default useMeetingAvailability;
