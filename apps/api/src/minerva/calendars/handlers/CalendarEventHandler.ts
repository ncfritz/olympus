import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { isRefusedRequest } from "../../utils/hasuraErrors";
import { recordCalendarEvent } from "../calendarMetrics";
import { actionOf, CALENDAR_EVENTS_SUBSCRIPTION } from "../messaging";
import { CalendarEventService } from "../services/CalendarEventService";

/** Waits after Hasura fails: 5 s, doubling, at most a minute. */
const FIRST_WAIT_MS = 5_000;
const LONGEST_WAIT_MS = 60_000;

/**
 * The API's consumer of the calendar sync agent's events (ADR 0028, which
 * settles ADR 0013's deferred consumer).
 *
 * - Written, or from an account no user owns: acknowledged.
 * - A message that can never be written (no known action, a malformed
 *   event, or one Hasura refused for its data): rejected to the
 *   dead-letter queue, where it waits to be looked at.
 * - Hasura not answering, or failing otherwise: back on the queue after a wait that grows while
 *   the failures continue, so an outage holds the queue rather than
 *   emptying it into the dead letters.
 */
@Injectable()
export class CalendarEventHandler {
  private readonly logger = new Logger(CalendarEventHandler.name);
  private failures = 0;

  constructor(private readonly events: CalendarEventService) {}

  @RabbitSubscribe(CALENDAR_EVENTS_SUBSCRIPTION)
  async handle(
    message: unknown,
    amqpMessage?: ConsumeMessage,
  ): Promise<Nack | void> {
    const routingKey = amqpMessage?.fields.routingKey;
    const action = actionOf(routingKey);
    const id = describeId(message);
    if (!action) {
      recordCalendarEvent("unknown", "invalid");
      this.logger.warn(
        `Dead-lettered calendar event ${id}: unknown routing key ${routingKey}`,
      );
      return new Nack(false);
    }

    try {
      const outcome = await this.events.consume(message);
      recordCalendarEvent(action, outcome.result);
      if (outcome.result === "invalid") {
        this.logger.warn(
          `Dead-lettered calendar event ${id}: ${outcome.problems.join("; ")}`,
        );
        return new Nack(false);
      }
      if (this.failures > 0) {
        this.logger.log(
          `Hasura is answering again after ${this.failures} failed calendar events`,
        );
      }
      this.failures = 0;
    } catch (error) {
      if (isRefusedRequest(error)) {
        // Hasura answered and refused it: retrying gets the same answer.
        recordCalendarEvent(action, "invalid");
        this.logger.error(
          `Dead-lettered calendar event ${id}: Hasura refused it: ${(error as Error).message}`,
        );
        return new Nack(false);
      }
      this.failures += 1;
      recordCalendarEvent(action, "failed");
      const wait = Math.min(
        FIRST_WAIT_MS * 2 ** (this.failures - 1),
        LONGEST_WAIT_MS,
      );
      const log =
        this.failures === 1 || this.failures % 10 === 0
          ? this.logger.warn.bind(this.logger)
          : this.logger.debug.bind(this.logger);
      log(
        `Writing calendar event ${id} failed (${this.failures} in a row), retrying in ${wait / 1000}s: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.wait(wait);
      return new Nack(true);
    }
  }

  /** The pause before a failed event goes back; replaced in the tests. */
  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const describeId = (message: unknown): string => {
  const id = (message as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "(no id)";
};
