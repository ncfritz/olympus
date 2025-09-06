import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { logger } from "../utils/logger";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): RabbitMQConfig => {
        const amqpProtocol = config.get<string>("AMQP_PROTOCOL", "amqp");
        const amqpHost = config.get<string>("AMQP_HOST", "localhost");
        const amqpPort = config.get<string>("AMQP_PORT", "5672");
        const amqpUser = config.get<string>("AMQP_USER", "admin");
        const amqpPassword = config.get<string>("AMQP_PASSWORD", "admin");
        const amqpVhost = config.get<string>("AMQP_VHOST", "/dionysus");

        const amqpEndpoint = `${amqpProtocol}://${amqpUser}:${amqpPassword}@${amqpHost}:${amqpPort}/${encodeURIComponent(
          amqpVhost,
        )}`;

        logger.info(`Attempting to connect to: ${amqpEndpoint}`);

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
          uri: amqpEndpoint,
        };
      },
    }),
  ],
  exports: [RabbitMQModule],
  providers: [],
  controllers: [],
})
export class RabbitModule {}
