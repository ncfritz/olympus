import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";

/**
 * The mail messages' own queues, by name (ADR 0030): sending a message to
 * a delay or dead-letter queue. The one place the consumer touches
 * RabbitMQ directly.
 */
@Injectable()
export class MailMessageQueues {
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
}
