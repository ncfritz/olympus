import {
  BATCH_JOB_TRIGGER_EXCHANGE,
  BATCH_JOB_WORKFLOW_EXCHANGE,
  CONTENT_TRIGGER_EXCHANGE,
  declare,
  DOWNLOAD_TRIGGER_EXCHANGE,
  MEDIA_TRIGGER_EXCHANGE,
  METADATA_JOB_TRIGGER_EXCHANGE,
  NOTIFICATIONS_TRIGGER_EXCHANGE,
  SEARCH_EXECUTION_TRIGGER_EXCHANGE,
} from "@ncfritz/olympus-messages";
import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Logger, Module } from "@nestjs/common";
import { amqpConfig, AmqpConfigType } from "../config/configuration";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [amqpConfig.KEY],
      useFactory: (amqp: AmqpConfigType): RabbitMQConfig => {
        new Logger(RabbitModule.name).log(`Connecting to ${amqp.redactedUri}`);

        return {
          // Every exchange the API publishes to, as the consumers declare
          // it, so publishing never depends on an agent having started.
          exchanges: declare(
            BATCH_JOB_TRIGGER_EXCHANGE,
            BATCH_JOB_WORKFLOW_EXCHANGE,
            METADATA_JOB_TRIGGER_EXCHANGE,
            CONTENT_TRIGGER_EXCHANGE,
            MEDIA_TRIGGER_EXCHANGE,
            DOWNLOAD_TRIGGER_EXCHANGE,
            SEARCH_EXECUTION_TRIGGER_EXCHANGE,
            NOTIFICATIONS_TRIGGER_EXCHANGE,
          ),
          connectionInitOptions: { wait: true },
          enableControllerDiscovery: true,
          uri: amqp.uri,
        };
      },
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitModule {}
