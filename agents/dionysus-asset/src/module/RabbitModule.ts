import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DOWNLOAD_TRIGGER_EXCHANGE,
  DOWNLOAD_UPDATE_EXCHANGE,
} from "../util/constants";
import { logger } from "../util/logger";

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

        logger.info(`AMQP endpoint: ${amqpEndpoint}`);

        return {
          channels: {
            transcodeMediaChannel: {
              prefetchCount: 1,
            },
            general: {
              prefetchCount: 1,
              default: true,
            },
          },
          exchanges: [
            {
              name: "content.trigger",
              type: "topic",
            },
            {
              name: "media.trigger",
              type: "topic",
            },
            {
              name: DOWNLOAD_TRIGGER_EXCHANGE,
              type: "x-delayed-message",
              options: {
                arguments: { "x-delayed-type": "direct" },
              },
            },
            {
              name: DOWNLOAD_UPDATE_EXCHANGE,
              type: "topic",
            },
          ],
          connectionInitOptions: { wait: true },
          enableControllerDiscovery: true,
          prefetchCount: 1,
          connectionManagerOptions: {
            heartbeatIntervalInSeconds: 30,
            reconnectTimeInSeconds: 1,
            connectionOptions: {
              keepAlive: true,
            },
          },
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
