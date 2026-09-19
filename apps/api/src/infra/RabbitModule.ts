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
          exchanges: [
            {
              name: "batchJob.trigger",
              type: "topic",
            },
            {
              name: "metadataJob.trigger",
              type: "x-delayed-message",
              options: {
                arguments: { "x-delayed-type": "direct" },
              },
            },
            {
              name: "notifications",
              type: "topic",
            },
          ],
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
