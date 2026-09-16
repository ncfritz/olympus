import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AvailabilitySlot, combineAvailability, mapFreeBusyToAvailability } from "../domain/availability";
import { EVENT_OVERRIDE_STORE, EventOverrideStore } from "../store/event-override-store";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { OVERRIDE_BLOCK_STORE, OverrideBlockStore } from "../store/override-block-store";

const SLOT_MS = 15 * 60 * 1000;
/** Sanity cap on the computed range — 92 days is ~8832 slots, comfortably cheap; anything past that is almost certainly a caller bug. */
const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(EVENT_STORE) private readonly events: EventStore,
    @Inject(EVENT_OVERRIDE_STORE) private readonly eventOverrides: EventOverrideStore,
    @Inject(OVERRIDE_BLOCK_STORE) private readonly overrideBlocks: OverrideBlockStore,
  ) {}

  async computeSlots(startIso: string, endIso: string): Promise<AvailabilitySlot[]> {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (!(start.getTime() < end.getTime())) {
      throw new BadRequestException("start must be before end");
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException(`Range too large — max is ${MAX_RANGE_MS / (24 * 60 * 60 * 1000)} days`);
    }

    const [events, blocks] = await Promise.all([
      this.events.listEventsOverlapping(startIso, endIso),
      this.overrideBlocks.listOverlapping(startIso, endIso),
    ]);
    const overrides = await this.eventOverrides.listOverrides(events.map((e) => e.id));
    const overrideByEventId = new Map(overrides.map((o) => [o.eventId, o.status]));

    const eventTimes = events.map((e) => ({
      status: overrideByEventId.get(e.id) ?? mapFreeBusyToAvailability(e.status),
      start: new Date(e.startTime).getTime(),
      end: new Date(e.endTime).getTime(),
    }));
    const blockTimes = blocks.map((b) => ({
      status: b.status,
      start: new Date(b.startTime).getTime(),
      end: new Date(b.endTime).getTime(),
    }));

    const slots: AvailabilitySlot[] = [];
    for (let slotStart = start.getTime(); slotStart < end.getTime(); slotStart += SLOT_MS) {
      const slotEnd = slotStart + SLOT_MS;

      const overlappingBlocks = blockTimes.filter((b) => b.start < slotEnd && b.end > slotStart);
      const status =
        overlappingBlocks.length > 0
          ? combineAvailability(overlappingBlocks.map((b) => b.status))
          : computeFromEvents(eventTimes, slotStart, slotEnd);

      slots.push({ startTime: new Date(slotStart).toISOString(), endTime: new Date(slotEnd).toISOString(), status });
    }

    return slots;
  }
}

function computeFromEvents(
  eventTimes: { status: AvailabilitySlot["status"]; start: number; end: number }[],
  slotStart: number,
  slotEnd: number,
): AvailabilitySlot["status"] {
  const overlapping = eventTimes.filter((e) => e.start < slotEnd && e.end > slotStart);
  return overlapping.length === 0 ? "free" : combineAvailability(overlapping.map((e) => e.status));
}
