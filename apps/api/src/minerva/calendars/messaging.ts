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
