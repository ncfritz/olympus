import type {
  CalendarEventDeadLetter,
  CalendarEventDeadLetters,
  CalendarEventRedrive,
} from "@ncfritz/olympus-model";
import { Injectable, Logger } from "@nestjs/common";
import moment from "moment";
import { recordCalendarEventRedrive } from "../calendarMetrics";
import {
  actionOf,
  attemptsOf,
  CALENDAR_EVENT_HEADERS,
  CALENDAR_EVENTS_QUEUE,
} from "../messaging";
import {
  CalendarEventQueues,
  type DeadCalendarEvent,
} from "./CalendarEventQueues";

/** How many dead letters a description shows. */
const SAMPLE_SIZE = 20;

/** The most one redrive moves, so a very long queue is worked through in calls. */
const REDRIVE_MAX = 1_000;

/**
 * The calendar events' dead-letter queue (ADR 0028, amended): what waits in
 * it, and putting it back on the events queue for another go, attempts
 * counted from nought.
 */
@Injectable()
export class CalendarEventDeadLetterService {
  private readonly logger = new Logger(CalendarEventDeadLetterService.name);

  constructor(private readonly queues: CalendarEventQueues) {}

  /**
   * How many wait, and the first of them. Looking means taking them off
   * the queue and putting them back, which is RabbitMQ's only way to read
   * a queue without consuming it.
   */
  async describe(): Promise<CalendarEventDeadLetters> {
    const count = await this.queues.countDead();
    const taken: DeadCalendarEvent[] = [];
    try {
      while (taken.length < Math.min(count, SAMPLE_SIZE)) {
        const dead = await this.queues.takeDead();
        if (!dead) break;
        taken.push(dead);
      }
    } finally {
      // Last first, so each goes back in front of the one after it.
      for (const dead of [...taken].reverse()) dead.release();
    }
    return { count, sample: taken.map(toDeadLetter) };
  }

  /**
   * Moves what waits now back onto the events queue, as it was first
   * published, with no attempts counted. Those that arrive while it runs
   * are left for the next redrive, so an event that fails at once cannot
   * keep one going for ever.
   */
  async redrive(): Promise<CalendarEventRedrive> {
    const waiting = Math.min(await this.queues.countDead(), REDRIVE_MAX);
    let redriven = 0;
    while (redriven < waiting) {
      const dead = await this.queues.takeDead();
      if (!dead) break;
      try {
        await this.queues.send(
          CALENDAR_EVENTS_QUEUE,
          dead.message,
          freshHeaders(dead.headers),
        );
      } catch (error) {
        dead.release();
        throw error;
      }
      dead.ack();
      redriven += 1;
    }
    recordCalendarEventRedrive(redriven);
    const remaining = await this.queues.countDead();
    this.logger.log(
      `Redrove ${redriven} dead-lettered calendar events; ${remaining} remain`,
    );
    return { redriven, remaining };
  }
}

/** A dead letter's headers for its next go: its routing key kept, the rest of the story dropped. */
const freshHeaders = (
  headers: Record<string, unknown>,
): Record<string, unknown> => {
  const kept: Record<string, unknown> = {};
  const routingKey = headers[CALENDAR_EVENT_HEADERS.routingKey];
  if (typeof routingKey === "string") {
    kept[CALENDAR_EVENT_HEADERS.routingKey] = routingKey;
  }
  return kept;
};

const toDeadLetter = (dead: DeadCalendarEvent): CalendarEventDeadLetter => {
  const message = dead.message as { id?: unknown } | null;
  const reason = dead.headers[CALENDAR_EVENT_HEADERS.deadReason];
  const deadAt = dead.headers[CALENDAR_EVENT_HEADERS.deadAt];
  const routingKey = dead.headers[CALENDAR_EVENT_HEADERS.routingKey];
  return {
    eventId: typeof message?.id === "string" ? message.id : undefined,
    action:
      typeof routingKey === "string"
        ? (actionOf(routingKey) ?? routingKey)
        : undefined,
    attempts: attemptsOf(dead.headers),
    reason: typeof reason === "string" ? reason : undefined,
    deadTime:
      typeof deadAt === "string" && moment(deadAt, moment.ISO_8601).isValid()
        ? moment.utc(deadAt)
        : undefined,
  };
};
