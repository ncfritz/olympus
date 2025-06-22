import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
        const amqpVhost = config.get<string>("AMQP_VHOST", "/dionysus-dev");

        const amqpEndpoint = `${amqpProtocol}://${amqpUser}:${amqpPassword}@${amqpHost}:${amqpPort}/${encodeURIComponent(
          amqpVhost,
        )}`;

        logger.info(`AMQP endpoint: ${amqpEndpoint}`);

        return {
          channels: {
            metadataChannel: {
              prefetchCount: 30,
            },
            batchJobsChannel: {
              prefetchCount: 1,
            },
            tvSeriesChannel: {
              prefetchCount: 10,
            },
            tvSeasonsChannel: {
              prefetchCount: 15,
            },
            tvEpisodesChannel: {
              prefetchCount: 70,
            },
            workflowChannel: {
              prefetchCount: 1,
            },
            general: {
              prefetchCount: 1,
              default: true,
            },
          },
          exchanges: [
            {
              name: "batchJob.trigger",
              type: "topic",
            },
            {
              name: "batchJob.workflow",
              type: "x-delayed-message",
              options: {
                arguments: { "x-delayed-type": "direct" },
              },
            },
            {
              name: "metadataJob.trigger",
              type: "x-delayed-message",
              options: {
                arguments: { "x-delayed-type": "direct" },
              },
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
