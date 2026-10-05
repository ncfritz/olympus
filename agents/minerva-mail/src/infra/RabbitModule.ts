import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { declare } from "@ncfritz/olympus-messages";
import { Logger, Module } from "@nestjs/common";
import { amqpConfig } from "../config/configuration";
import type { AmqpConfigType } from "../config/configuration";
import { MAIL_MESSAGES_EXCHANGE } from "../messaging";

/**
 * The broker connection: the agent publishes message metadata and
 * consumes nothing yet. The exchange is declared here too, so publishing
 * never depends on the API having started.
 */
export const rabbitConfig = (amqp: AmqpConfigType): RabbitMQConfig => ({
  exchanges: declare(MAIL_MESSAGES_EXCHANGE),
  connectionInitOptions: { wait: true },
  uri: amqp.uri,
});

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [amqpConfig.KEY],
      useFactory: (amqp: AmqpConfigType) => {
        new Logger(RabbitModule.name).log(`Connecting to ${amqp.redactedUri}`);
        return rabbitConfig(amqp);
      },
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitModule {}
