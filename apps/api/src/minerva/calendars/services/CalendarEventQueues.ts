import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { CALENDAR_EVENTS_DEAD_LETTER_QUEUE } from "../messaging";

/** A message taken from the dead-letter queue, to be settled one way or the other. */
export interface DeadCalendarEvent {
  message: unknown;
  headers: Record<string, unknown>;
  /** Done with: it leaves the queue. */
  ack(): void;
  /** Put back where it was. */
  release(): void;
}

/**
 * The calendar events' own queues, by name (ADR 0028): sending a message
 * to a delay or dead-letter queue, and taking from the dead-letter queue.
 * The one place the consumer and the redrive touch RabbitMQ directly.
 */
@Injectable()
export class CalendarEventQueues {
  constructor(private readonly amqp: AmqpConnection) {}

  /** Puts a message on a queue, through the default exchange, persistent. */
  async send(
    queue: string,
    message: unknown,
    headers: Record<string, unknown>,
  ): Promise<void> {
    await this.amqp.publish("", queue, message, {
      headers,
      persistent: true,
      contentType: "application/json",
    });
  }

  /** How many messages the dead-letter queue holds. */
  async countDead(): Promise<number> {
    const { messageCount } = await this.amqp.channel.checkQueue(
      CALENDAR_EVENTS_DEAD_LETTER_QUEUE,
    );
    return messageCount;
  }

  /** The dead-letter queue's next message, unacknowledged; undefined when it is empty. */
  async takeDead(): Promise<DeadCalendarEvent | undefined> {
    const channel = this.amqp.channel;
    const delivery = await channel.get(CALENDAR_EVENTS_DEAD_LETTER_QUEUE, {
      noAck: false,
    });
    if (!delivery) return undefined;
    let message: unknown;
    try {
      message = JSON.parse(delivery.content.toString());
    } catch {
      message = delivery.content.toString();
    }
    return {
      message,
      headers: {
        ...(delivery.properties.headers ?? {}),
        // A message dead-lettered by RabbitMQ (rejected) rather than sent
        // here by the consumer keeps only its first routing key.
        ...(typeof delivery.properties.headers?.["x-olympus-routing-key"] ===
        "string"
          ? {}
          : { "x-olympus-routing-key": firstRoutingKey(delivery) }),
      },
      ack: () => channel.ack(delivery),
      release: () => channel.nack(delivery, false, true),
    };
  }
}

/** The routing key a message RabbitMQ dead-lettered was first published with. */
const firstRoutingKey = (delivery: {
  fields: { routingKey: string };
  properties: { headers?: Record<string, unknown> };
}): string => {
  const deaths = delivery.properties.headers?.["x-death"];
  const first = Array.isArray(deaths)
    ? (deaths.at(-1) as { "routing-keys"?: unknown[] } | undefined)
    : undefined;
  const key = first?.["routing-keys"]?.[0];
  return typeof key === "string" ? key : delivery.fields.routingKey;
};
