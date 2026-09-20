import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AvailabilitySlot,
  AvailabilityStatus,
  combineAvailability,
  mapFreeBusyToAvailability,
} from "../domain/availability";
import {
  CALENDAR_BUSY_INCLUSION_STORE,
  CalendarBusyInclusionStore,
} from "../store/calendar-busy-inclusion-store";
import {
  EVENT_OVERRIDE_STORE,
  EventOverrideStore,
} from "../store/event-override-store";
import { EVENT_STORE, EventStore } from "../store/event-store";
import {
  OVERRIDE_BLOCK_STORE,
  OverrideBlockStore,
} from "../store/override-block-store";
import { SyncConfigService } from "../sync/sync-config.service";

const SLOT_MS = 15 * 60 * 1000;
/** Sanity cap on the computed range — 92 days is ~8832 slots, comfortably cheap; anything past that is almost certainly a caller bug. */
const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;
const DEFAULT_DAY_START = "08:00";
const DEFAULT_DAY_END = "18:00";
const DEFAULT_TIMEZONE = "UTC";

interface TimedStatus {
  status: AvailabilityStatus;
  start: number;
  end: number;
}

export interface StatusTimelineOptions {
  /** HH:mm, 24-hour, in `timezone`. Defaults to "08:00". */
  dayStart?: string;
  /** HH:mm, 24-hour, in `timezone` — exclusive. Defaults to "18:00". */
  dayEnd?: string;
  /** Defaults to false. */
  treatWeekendsAsWorking?: boolean;
  /** IANA name (e.g. "America/Los_Angeles"). Defaults to "UTC". */
  timezone?: string;
}

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(EVENT_STORE) private readonly events: EventStore,
    @Inject(EVENT_OVERRIDE_STORE)
    private readonly eventOverrides: EventOverrideStore,
    @Inject(OVERRIDE_BLOCK_STORE)
    private readonly overrideBlocks: OverrideBlockStore,
    @Inject(CALENDAR_BUSY_INCLUSION_STORE)
    private readonly busyInclusion: CalendarBusyInclusionStore,
    private readonly syncConfig: SyncConfigService,
  ) {}

  async computeSlots(
    startIso: string,
    endIso: string,
  ): Promise<AvailabilitySlot[]> {
    const { start, end } = this.validateRange(startIso, endIso);
    const { eventTimes, blockTimes } = await this.loadContributions(
      startIso,
      endIso,
    );

    const slots: AvailabilitySlot[] = [];
    for (let slotStart = start; slotStart < end; slotStart += SLOT_MS) {
      const slotEnd = slotStart + SLOT_MS;
      const status = computeStatus(
        eventTimes,
        blockTimes,
        slotStart,
        slotEnd,
        "free",
      );
      slots.push({
        startTime: new Date(slotStart).toISOString(),
        endTime: new Date(slotEnd).toISOString(),
        status,
      });
    }

    return slots;
  }

  /**
   * The calendar's per-15-minute status timeline, shown as a strip on the
   * week/day views. Two rules narrow what counts as "working time" beyond
   * the requested range, both evaluated in `options.timezone` (default
   * UTC, since without one there's no meaningful "8am" for anyone):
   *
   *  - A day-start/day-end window (default 08:00-18:00). Outside it, a
   *    synced meeting's own status is ignored entirely — only a deliberate
   *    override should show through — so the slot is "none" unless an
   *    override (block or per-event) overlaps it, in which case the
   *    override's own status is used.
   *  - Weekends, unless `treatWeekendsAsWorking` is set: treated exactly
   *    like being outside the window above, regardless of time of day.
   *
   * Keyed by each chunk's start time in minutes since epoch, per the API
   * contract.
   */
  async computeTimeline(
    startIso: string,
    endIso: string,
    options: StatusTimelineOptions = {},
  ): Promise<Record<string, AvailabilityStatus>> {
    const { start, end } = this.validateRange(startIso, endIso);
    const dayStartMinutes = parseTimeOfDay(
      options.dayStart ?? DEFAULT_DAY_START,
      "dayStart",
    );
    const dayEndMinutes = parseTimeOfDay(
      options.dayEnd ?? DEFAULT_DAY_END,
      "dayEnd",
    );
    if (!(dayStartMinutes < dayEndMinutes)) {
      throw new BadRequestException("dayStart must be before dayEnd");
    }
    const treatWeekendsAsWorking = options.treatWeekendsAsWorking ?? false;
    const timezone = options.timezone ?? DEFAULT_TIMEZONE;
    const zonedParts = zonedPartsFormatter(timezone);

    const { eventTimes, blockTimes } = await this.loadContributions(
      startIso,
      endIso,
    );
    const overrideOnlyEventTimes = eventTimes.filter((e) => e.isOverride);

    const timeline: Record<string, AvailabilityStatus> = {};
    for (let slotStart = start; slotStart < end; slotStart += SLOT_MS) {
      const slotEnd = slotStart + SLOT_MS;
      const inWorkingWindow = isWithinWorkingWindow(
        slotStart,
        dayStartMinutes,
        dayEndMinutes,
        treatWeekendsAsWorking,
        zonedParts,
      );
      const status = inWorkingWindow
        ? computeStatus(eventTimes, blockTimes, slotStart, slotEnd, "free")
        : computeStatus(
            overrideOnlyEventTimes,
            blockTimes,
            slotStart,
            slotEnd,
            "none",
          );
      timeline[String(Math.floor(slotStart / 60_000))] = status;
    }

    return timeline;
  }

  private async loadContributions(
    startIso: string,
    endIso: string,
  ): Promise<{
    eventTimes: (TimedStatus & { isOverride: boolean })[];
    blockTimes: TimedStatus[];
  }> {
    const [allEvents, blocks, excludedSources] = await Promise.all([
      this.events.listEventsOverlapping(startIso, endIso),
      this.overrideBlocks.listOverlapping(startIso, endIso),
      this.excludedSources(),
    ]);
    // A calendar switched off from busy calculation (e.g. a shared holidays
    // calendar) is dropped here, before overrides are even considered — its
    // events stay synced and visible elsewhere, just not weighed in here.
    const events = allEvents.filter((e) => !excludedSources.has(e.source));
    const overrides = await this.eventOverrides.listOverrides(
      events.map((e) => e.id),
    );
    const overrideByEventId = new Map(
      overrides.map((o) => [o.eventId, o.status]),
    );

    const eventTimes = events.map((e) => {
      const overrideStatus = overrideByEventId.get(e.id);
      return {
        status: overrideStatus ?? mapFreeBusyToAvailability(e.status),
        isOverride: overrideStatus !== undefined,
        start: new Date(e.startTime).getTime(),
        end: new Date(e.endTime).getTime(),
      };
    });
    const blockTimes = blocks.map((b) => ({
      status: b.status,
      start: new Date(b.startTime).getTime(),
      end: new Date(b.endTime).getTime(),
    }));

    return { eventTimes, blockTimes };
  }

  /**
   * Source labels of calendars explicitly excluded from busy calculation.
   * Events only carry a `source` label, not a calendarId (see
   * CalendarColorStore for the same constraint), so the exclusion —
   * naturally keyed by calendarId — is translated via SyncConfigService.
   */
  private async excludedSources(): Promise<Set<string>> {
    const [calendars, overrides] = await Promise.all([
      this.syncConfig.getAll(),
      this.busyInclusion.listOverrides(),
    ]);
    const excluded = new Set<string>();
    for (const calendar of calendars) {
      if (overrides[calendar.calendarId] === false) {
        excluded.add(calendar.source);
      }
    }
    return excluded;
  }

  private validateRange(
    startIso: string,
    endIso: string,
  ): { start: number; end: number } {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (!(start < end)) {
      throw new BadRequestException("start must be before end");
    }
    if (end - start > MAX_RANGE_MS) {
      throw new BadRequestException(
        `Range too large — max is ${MAX_RANGE_MS / (24 * 60 * 60 * 1000)} days`,
      );
    }
    return { start, end };
  }
}

/** Blocks always win over every other contribution; failing that, combine whatever overlaps, or fall back to `fallback` if nothing does. */
function computeStatus(
  times: TimedStatus[],
  blockTimes: TimedStatus[],
  slotStart: number,
  slotEnd: number,
  fallback: AvailabilityStatus,
): AvailabilityStatus {
  const overlappingBlocks = blockTimes.filter(
    (b) => b.start < slotEnd && b.end > slotStart,
  );
  if (overlappingBlocks.length > 0) {
    return combineAvailability(overlappingBlocks.map((b) => b.status));
  }
  const overlapping = times.filter(
    (t) => t.start < slotEnd && t.end > slotStart,
  );
  return overlapping.length === 0
    ? fallback
    : combineAvailability(overlapping.map((t) => t.status));
}

function parseTimeOfDay(value: string, field: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new BadRequestException(`${field} must be HH:mm`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Builds the Intl.DateTimeFormat that reads a slot's weekday/time-of-day in
 * `timezone` — built once per computeTimeline call and reused across every
 * slot, since constructing one per slot (there can be thousands) is
 * needlessly expensive. Throws BadRequestException up front for an
 * unrecognized IANA name, rather than failing confusingly mid-loop.
 */
function zonedPartsFormatter(
  timezone: string,
): (epochMs: number) => { weekday: number; minutesOfDay: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    throw new BadRequestException(
      `timezone must be a valid IANA name — got "${timezone}"`,
    );
  }

  return (epochMs: number) => {
    const parts = formatter.formatToParts(new Date(epochMs));
    const weekdayPart = parts.find((p) => p.type === "weekday")!.value;
    const hourPart = parts.find((p) => p.type === "hour")!.value;
    const minutePart = parts.find((p) => p.type === "minute")!.value;
    // Some ICU builds format midnight as "24" rather than "00" when hour12 is false.
    const hour = Number(hourPart) % 24;
    return {
      weekday: WEEKDAY_INDEX[weekdayPart],
      minutesOfDay: hour * 60 + Number(minutePart),
    };
  };
}

function isWithinWorkingWindow(
  slotStartMs: number,
  dayStartMinutes: number,
  dayEndMinutes: number,
  treatWeekendsAsWorking: boolean,
  zonedParts: (epochMs: number) => { weekday: number; minutesOfDay: number },
): boolean {
  const { weekday, minutesOfDay } = zonedParts(slotStartMs);
  if ((weekday === 0 || weekday === 6) && !treatWeekendsAsWorking) {
    return false;
  }
  return minutesOfDay >= dayStartMinutes && minutesOfDay < dayEndMinutes;
}
