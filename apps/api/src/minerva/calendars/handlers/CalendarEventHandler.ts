import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { isRefusedRequest } from "../../utils/hasuraErrors";
import { recordCalendarEvent } from "../calendarMetrics";
import {
  actionOf,
  attemptsOf,
  CALENDAR_EVENT_HEADERS,
  CALENDAR_EVENTS_DEAD_LETTER_QUEUE,
  CALENDAR_EVENTS_MAX_ATTEMPTS,
  CALENDAR_EVENTS_SUBSCRIPTION,
  retryQueueFor,
  routingKeyOf,
} from "../messaging";
import { CalendarEventQueues } from "../services/CalendarEventQueues";
import { CalendarEventService } from "../services/CalendarEventService";

/**
 * The API's consumer of the calendar sync agent's events (ADR 0028, which
 * settles ADR 0013's deferred consumer).
 *
 * - Written, or from an account no user owns: acknowledged.
 * - A message that can never be written (no known action, a malformed
 *   event, or one Hasura refused for its data): to the dead-letter queue,
 *   with the reason, where it waits to be looked at and redriven.
 * - Hasura not answering, or failing otherwise: to a delay queue, which
 *   brings it back after five seconds, thirty, then five minutes, counting
 *   the attempts; after the tenth it goes to the dead-letter queue too.
 *   Nothing is requeued in place, so one failing event never holds up the
 *   rest, and none is retried for ever.
 */
@Injectable()
export class CalendarEventHandler {
  private readonly logger = new Logger(CalendarEventHandler.name);

  constructor(
    private readonly events: CalendarEventService,
    private readonly queues: CalendarEventQueues,
  ) {}

  @RabbitSubscribe(CALENDAR_EVENTS_SUBSCRIPTION)
  async handle(message: unknown, amqpMessage?: ConsumeMessage): Promise<void> {
    const headers = (amqpMessage?.properties?.headers ?? {}) as Record<
      string,
      unknown
    >;
    const routingKey = routingKeyOf(amqpMessage);
    const action = actionOf(routingKey);
    const id = describeId(message);
    const delivery: Delivery = { message, headers, routingKey, id };
    if (!action) {
      recordCalendarEvent("unknown", "invalid");
      return this.deadLetter(delivery, `unknown routing key ${routingKey}`);
    }

    try {
      const outcome = await this.events.consume(message);
      recordCalendarEvent(action, outcome.result);
      if (outcome.result === "invalid") {
        return this.deadLetter(delivery, outcome.problems.join("; "));
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (isRefusedRequest(error)) {
        // Hasura answered and refused it: retrying gets the same answer.
        recordCalendarEvent(action, "invalid");
        return this.deadLetter(delivery, `Hasura refused it: ${reason}`);
      }
      const attempts = attemptsOf(headers) + 1;
      if (attempts >= CALENDAR_EVENTS_MAX_ATTEMPTS) {
        recordCalendarEvent(action, "gave_up");
        return this.deadLetter(
          delivery,
          `gave up after ${attempts} attempts: ${reason}`,
          attempts,
        );
      }
      recordCalendarEvent(action, "retried");
      const queue = retryQueueFor(attempts);
      await this.queues.send(queue, message, {
        ...headers,
        [CALENDAR_EVENT_HEADERS.attempts]: attempts,
        [CALENDAR_EVENT_HEADERS.routingKey]: routingKey,
      });
      // The first failure and every fifth, so an outage is seen without
      // a line for every event every time.
      const log =
        attempts === 1 || attempts % 5 === 0
          ? this.logger.warn.bind(this.logger)
          : this.logger.debug.bind(this.logger);
      log(
        `Writing calendar event ${id} failed (attempt ${attempts} of ${CALENDAR_EVENTS_MAX_ATTEMPTS}), retrying through ${queue}: ${reason}`,
      );
    }
  }

  /**
   * Sends the message to the dead-letter queue with why, and acknowledges
   * it here. Should the send itself fail, the subscription rejects the
   * message, which dead-letters it all the same, without the reason.
   */
  private async deadLetter(
    delivery: Delivery,
    reason: string,
    attempts = attemptsOf(delivery.headers),
  ): Promise<void> {
    await this.queues.send(
      CALENDAR_EVENTS_DEAD_LETTER_QUEUE,
      delivery.message,
      {
        ...delivery.headers,
        [CALENDAR_EVENT_HEADERS.attempts]: attempts,
        [CALENDAR_EVENT_HEADERS.routingKey]: delivery.routingKey,
        [CALENDAR_EVENT_HEADERS.deadReason]: reason,
        [CALENDAR_EVENT_HEADERS.deadAt]: new Date().toISOString(),
      },
    );
    this.logger.warn(`Dead-lettered calendar event ${delivery.id}: ${reason}`);
  }
}

/** What the consumer keeps of a delivery to pass it on. */
interface Delivery {
  message: unknown;
  headers: Record<string, unknown>;
  routingKey: string | undefined;
  id: string;
}

const describeId = (message: unknown): string => {
  const id = (message as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "(no id)";
};
