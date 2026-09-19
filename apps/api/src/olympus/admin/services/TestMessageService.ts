import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { TestRequest } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";

/** RabbitMQ test messages published by the admin API. */
@Injectable()
export class TestMessageService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  /** Publishes `message` to `exchange` with `routingKey`. */
  async send(
    exchange: string,
    routingKey: string,
    message: TestRequest,
  ): Promise<void> {
    await this.amqpConnection.publish(exchange, routingKey, message);
  }
}
