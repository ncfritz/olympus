import { MessageHandlerErrorBehavior } from "@golevelup/nestjs-rabbitmq";
import {
  MAIL_MESSAGE_ACTIONS,
  MAIL_MESSAGES_EXCHANGE,
  type MailMessageAction,
} from "@ncfritz/olympus-messages";

/**
 * The API's queue on the mail agent's message metadata (ADR 0030): every
 * action (`message.*`), twenty messages in flight, and a dead-letter queue
 * for those that can never be written. Retries and dead letters work as
 * the calendar events consumer's do (ADR 0028, amended).
 */
export const MAIL_MESSAGES_QUEUE = "olympus-api.mail-messages";
export const MAIL_MESSAGES_DEAD_LETTER_QUEUE = `${MAIL_MESSAGES_QUEUE}.dead`;

/**
 * The delay queues a failed message waits in before it is tried again.
 * None is consumed: each holds a message for its time, then dead-letters
 * it back onto the messages queue.
 */
export const MAIL_MESSAGES_RETRY_QUEUES = [
  { name: `${MAIL_MESSAGES_QUEUE}.retry.5s`, delayMs: 5_000 },
  { name: `${MAIL_MESSAGES_QUEUE}.retry.30s`, delayMs: 30_000 },
  { name: `${MAIL_MESSAGES_QUEUE}.retry.5m`, delayMs: 300_000 },
] as const;

/** Tries before the dead-letter queue: about half an hour in all. */
export const MAIL_MESSAGES_MAX_ATTEMPTS = 10;

/** The delay queue for a message about to be tried for the `attempt`th time after the first. */
export const retryQueueFor = (attempt: number): string =>
  MAIL_MESSAGES_RETRY_QUEUES[attempt <= 2 ? 0 : attempt <= 5 ? 1 : 2].name;

/** Headers the consumer keeps on a message it retries or dead-letters. */
export const MAIL_MESSAGE_HEADERS = {
  attempts: "x-olympus-attempts",
  routingKey: "x-olympus-routing-key",
  deadReason: "x-olympus-dead-reason",
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
  const kept = delivery?.properties?.headers?.[MAIL_MESSAGE_HEADERS.routingKey];
  return typeof kept === "string" ? kept : delivery?.fields?.routingKey;
};

/** How many times a delivery has failed before. */
export const attemptsOf = (
  headers: Record<string, unknown> | undefined,
): number => {
  const attempts = Number(headers?.[MAIL_MESSAGE_HEADERS.attempts]);
  return Number.isInteger(attempts) && attempts > 0 ? attempts : 0;
};

/** The consumer's channel and its prefetch, for RabbitModule's `channels`. */
export const MAIL_MESSAGES_CHANNEL = "mailMessagesChannel";
export const MAIL_MESSAGES_PREFETCH = 20;

/** @RabbitSubscribe options of MailMessageHandler. */
export const MAIL_MESSAGES_SUBSCRIPTION = {
  exchange: MAIL_MESSAGES_EXCHANGE.name,
  routingKey: "message.*",
  queue: MAIL_MESSAGES_QUEUE,
  queueOptions: {
    durable: true,
    channel: MAIL_MESSAGES_CHANNEL,
    // Rejected without requeue → the dead-letter queue, through the
    // default exchange.
    deadLetterExchange: "",
    deadLetterRoutingKey: MAIL_MESSAGES_DEAD_LETTER_QUEUE,
  },
  // Anything thrown before or around the handler is dead-lettered, never
  // put straight back on the queue to fail again for ever.
  errorBehavior: MessageHandlerErrorBehavior.NACK,
};

/** The action of a message from its routing key, `message.<action>`. */
export const actionOf = (
  routingKey: string | undefined,
): MailMessageAction | undefined => {
  const action = routingKey?.startsWith("message.")
    ? routingKey.slice("message.".length)
    : undefined;
  return MAIL_MESSAGE_ACTIONS.find((a) => a === action);
};
