import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { isRefusedRequest } from "../../utils/hasuraErrors";
import { recordMailMessage } from "../mailMetrics";
import {
  actionOf,
  attemptsOf,
  MAIL_MESSAGE_HEADERS,
  MAIL_MESSAGES_DEAD_LETTER_QUEUE,
  MAIL_MESSAGES_MAX_ATTEMPTS,
  MAIL_MESSAGES_SUBSCRIPTION,
  retryQueueFor,
  routingKeyOf,
} from "../messaging";
import { MailMessageQueues } from "../services/MailMessageQueues";
import { MailMessageService } from "../services/MailMessageService";

/**
 * The API's consumer of the mail agent's message metadata (ADR 0030), with
 * the calendar consumer's handling of failures (ADR 0028, amended):
 *
 * - Written, stale, or for an account that is gone: acknowledged.
 * - A message that can never be written (no known action, a malformed
 *   message, or one Hasura refused for its data): to the dead-letter
 *   queue, with the reason.
 * - Hasura not answering, or failing otherwise: to a delay queue, back
 *   after five seconds, thirty, then five minutes; after the tenth
 *   attempt, to the dead-letter queue too.
 *
 * Logs name a message by its Gmail ID only, never by anything it says.
 */
@Injectable()
export class MailMessageHandler {
  private readonly logger = new Logger(MailMessageHandler.name);

  constructor(
    private readonly messages: MailMessageService,
    private readonly queues: MailMessageQueues,
  ) {}

  @RabbitSubscribe(MAIL_MESSAGES_SUBSCRIPTION)
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
      recordMailMessage("unknown", "invalid");
      return this.deadLetter(delivery, `unknown routing key ${routingKey}`);
    }

    try {
      const outcome = await this.messages.consume(message);
      recordMailMessage(action, outcome.result);
      if (outcome.result === "invalid") {
        return this.deadLetter(delivery, outcome.problems.join("; "));
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (isRefusedRequest(error)) {
        // Hasura answered and refused it: retrying gets the same answer.
        recordMailMessage(action, "invalid");
        return this.deadLetter(delivery, `Hasura refused it: ${reason}`);
      }
      const attempts = attemptsOf(headers) + 1;
      if (attempts >= MAIL_MESSAGES_MAX_ATTEMPTS) {
        recordMailMessage(action, "gave_up");
        return this.deadLetter(
          delivery,
          `gave up after ${attempts} attempts: ${reason}`,
          attempts,
        );
      }
      recordMailMessage(action, "retried");
      const queue = retryQueueFor(attempts);
      await this.queues.send(queue, message, {
        ...headers,
        [MAIL_MESSAGE_HEADERS.attempts]: attempts,
        [MAIL_MESSAGE_HEADERS.routingKey]: routingKey,
      });
      // The first failure and every fifth, so an outage is seen without a
      // line for every message every time.
      const log =
        attempts === 1 || attempts % 5 === 0
          ? this.logger.warn.bind(this.logger)
          : this.logger.debug.bind(this.logger);
      log(
        `Writing mail message ${id} failed (attempt ${attempts} of ${MAIL_MESSAGES_MAX_ATTEMPTS}), retrying through ${queue}: ${reason}`,
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
    await this.queues.send(MAIL_MESSAGES_DEAD_LETTER_QUEUE, delivery.message, {
      ...delivery.headers,
      [MAIL_MESSAGE_HEADERS.attempts]: attempts,
      [MAIL_MESSAGE_HEADERS.routingKey]: delivery.routingKey,
      [MAIL_MESSAGE_HEADERS.deadReason]: reason,
      [MAIL_MESSAGE_HEADERS.deadAt]: new Date().toISOString(),
    });
    this.logger.warn(`Dead-lettered mail message ${delivery.id}: ${reason}`);
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
  const id = (message as { gmailId?: unknown } | null)?.gmailId;
  return typeof id === "string" ? id : "(no id)";
};
