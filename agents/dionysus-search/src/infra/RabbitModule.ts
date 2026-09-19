import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import {
  declare,
  SEARCH_EXECUTION_TRIGGER_EXCHANGE,
  SEARCH_FANOUT_TRIGGER_EXCHANGE,
} from "@ncfritz/olympus-messages";
import { Logger, Module } from "@nestjs/common";
import { amqpConfig } from "../config/configuration";
import type { AmqpConfigType } from "../config/configuration";

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [amqpConfig.KEY],
      useFactory: (amqp: AmqpConfigType): RabbitMQConfig => {
        new Logger(RabbitModule.name).log(`Connecting to ${amqp.redactedUri}`);
        return {
          channels: {
            general: {
              prefetchCount: 1,
              default: true,
            },
          },
          exchanges: declare(
            SEARCH_FANOUT_TRIGGER_EXCHANGE,
            SEARCH_EXECUTION_TRIGGER_EXCHANGE,
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
