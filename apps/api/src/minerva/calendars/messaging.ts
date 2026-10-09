import { MessageHandlerErrorBehavior } from "@golevelup/nestjs-rabbitmq";
import {
  CALENDAR_EVENTS_EXCHANGE,
  type CalendarEventAction,
  CALENDAR_EVENT_ACTIONS,
} from "@ncfritz/olympus-messages";

/**
 * The API's queue on the calendar sync agent's events (ADR 0028): every
 * action (`event.*`), twenty messages in flight, and a dead-letter queue
 * for those that can never be written.
 */
export const CALENDAR_EVENTS_QUEUE = "olympus-api.calendar-events";
export const CALENDAR_EVENTS_DEAD_LETTER_QUEUE = `${CALENDAR_EVENTS_QUEUE}.dead`;

/**
 * The delay queues a failed event waits in before it is tried again
 * (ADR 0028, amended). None is consumed: each holds a message for its
 * time, then dead-letters it back onto the events queue. Queue-wide times
 * rather than one per message, because RabbitMQ only expires the message
 * at a queue's head: a five-minute wait would hold up a five-second one
 * behind it.
 */
export const CALENDAR_EVENTS_RETRY_QUEUES = [
  { name: `${CALENDAR_EVENTS_QUEUE}.retry.5s`, delayMs: 5_000 },
  { name: `${CALENDAR_EVENTS_QUEUE}.retry.30s`, delayMs: 30_000 },
  { name: `${CALENDAR_EVENTS_QUEUE}.retry.5m`, delayMs: 300_000 },
] as const;

/**
 * How many times an event is tried before it goes to the dead-letter
 * queue: twice at five seconds, three times at thirty, then every five
 * minutes, about half an hour in all.
 */
export const CALENDAR_EVENTS_MAX_ATTEMPTS = 10;

/** The delay queue for an event about to be tried for the `attempt`th time after the first. */
export const retryQueueFor = (attempt: number): string =>
  CALENDAR_EVENTS_RETRY_QUEUES[attempt <= 2 ? 0 : attempt <= 5 ? 1 : 2].name;

/** Headers the consumer keeps on a message it retries or dead-letters. */
export const CALENDAR_EVENT_HEADERS = {
  /** How many times it has failed. */
  attempts: "x-olympus-attempts",
  /**
   * The routing key it was published with: a message that comes back
   * through a delay or dead-letter queue arrives with the queue's name
   * instead.
   */
  routingKey: "x-olympus-routing-key",
  /** Why it was dead-lettered. */
  deadReason: "x-olympus-dead-reason",
  /** When, ISO-8601. */
  deadAt: "x-olympus-dead-at",
} as const;

/** The routing key a delivery was first published with. */
export const routingKeyOf = (
  delivery:
    | {
        fields?: { routingKey?: string };
        properties?: { headers?: Record<string, unknown> };
      }
    | undefined,
): string | undefined => {
  const kept =
    delivery?.properties?.headers?.[CALENDAR_EVENT_HEADERS.routingKey];
  return typeof kept === "string" ? kept : delivery?.fields?.routingKey;
};

/** How many times a delivery has failed before. */
export const attemptsOf = (
  headers: Record<string, unknown> | undefined,
): number => {
  const attempts = Number(headers?.[CALENDAR_EVENT_HEADERS.attempts]);
  return Number.isInteger(attempts) && attempts > 0 ? attempts : 0;
};

/** The consumer's channel and its prefetch, for RabbitModule's `channels`. */
export const CALENDAR_EVENTS_CHANNEL = "calendarEventsChannel";
export const CALENDAR_EVENTS_PREFETCH = 20;

/** @RabbitSubscribe options of CalendarEventHandler. */
export const CALENDAR_EVENTS_SUBSCRIPTION = {
  exchange: CALENDAR_EVENTS_EXCHANGE.name,
  routingKey: "event.*",
  queue: CALENDAR_EVENTS_QUEUE,
  queueOptions: {
    durable: true,
    channel: CALENDAR_EVENTS_CHANNEL,
    // Rejected without requeue → the dead-letter queue, through the
    // default exchange.
    deadLetterExchange: "",
    deadLetterRoutingKey: CALENDAR_EVENTS_DEAD_LETTER_QUEUE,
  },
  // Anything thrown before or around the handler (a guard, an
  // interceptor, a bug) rejects the message to the dead-letter queue. The
  // library's default puts it straight back on the queue, where it fails
  // again for ever.
  errorBehavior: MessageHandlerErrorBehavior.NACK,
};

/** The action of a message from its routing key, `event.<action>`. */
export const actionOf = (
  routingKey: string | undefined,
): CalendarEventAction | undefined => {
  const action = routingKey?.startsWith("event.")
    ? routingKey.slice("event.".length)
    : undefined;
  return CALENDAR_EVENT_ACTIONS.find((a) => a === action);
};
