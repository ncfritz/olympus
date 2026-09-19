import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import {
  CONTENT_TRIGGER_EXCHANGE,
  declare,
  DOWNLOAD_TRIGGER_EXCHANGE,
  DOWNLOAD_UPDATE_EXCHANGE,
  MEDIA_TRIGGER_EXCHANGE,
} from "@ncfritz/olympus-messages";
import { Logger, Module } from "@nestjs/common";
import { amqpConfig } from "../config/configuration";
import type { AmqpConfigType } from "../config/configuration";
import { CHANNELS } from "../messaging";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [amqpConfig.KEY],
      useFactory: (amqp: AmqpConfigType): RabbitMQConfig => {
        new Logger(RabbitModule.name).log(`Connecting to ${amqp.redactedUri}`);
        return {
          channels: {
            ...Object.fromEntries(
              Object.entries(CHANNELS).map(([name, prefetchCount]) => [
                name,
                { prefetchCount },
              ]),
            ),
            general: {
              prefetchCount: 1,
              default: true,
            },
          },
          exchanges: declare(
            CONTENT_TRIGGER_EXCHANGE,
            MEDIA_TRIGGER_EXCHANGE,
            DOWNLOAD_TRIGGER_EXCHANGE,
            DOWNLOAD_UPDATE_EXCHANGE,
          ),
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
          uri: amqp.uri,
        };
      },
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitModule {}
