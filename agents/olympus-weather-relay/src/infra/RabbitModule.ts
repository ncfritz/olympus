import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { declare } from "@ncfritz/olympus-messages";
import { Logger, Module } from "@nestjs/common";
import { amqpConfig, relayConfig } from "../config/configuration";
import type { AmqpConfigType, RelayConfigType } from "../config/configuration";
import {
  RELAY_QUEUE_ARGUMENTS,
  relayQueue,
  WEATHER_ARCHIVE_LINE_ROUTE,
  WEATHER_RELAY_HANDLER,
  WEATHER_STATION_REPORTS_EXCHANGE,
} from "../messaging";

/**
 * The broker connection. The relay's queue is named by the database it
 * feeds, so its binding is a named handler configuration here rather than
 * in the handler's decorator.
 */
export const rabbitConfig = (
  amqp: AmqpConfigType,
  relay: RelayConfigType,
): RabbitMQConfig => ({
  exchanges: declare(WEATHER_STATION_REPORTS_EXCHANGE),
  handlers: {
    [WEATHER_RELAY_HANDLER]: {
      exchange: WEATHER_ARCHIVE_LINE_ROUTE.exchange.name,
      routingKey: WEATHER_ARCHIVE_LINE_ROUTE.routingKey,
      queue: relayQueue(relay.database),
      queueOptions: { durable: true, arguments: RELAY_QUEUE_ARGUMENTS },
    },
  },
  // One line at a time: while the API is away the relay waits, and the
  // queue holds the rest.
  prefetchCount: 1,
  connectionInitOptions: { wait: true },
  enableControllerDiscovery: true,
  uri: amqp.uri,
});

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [amqpConfig.KEY, relayConfig.KEY],
      useFactory: (amqp: AmqpConfigType, relay: RelayConfigType) => {
        new Logger(RabbitModule.name).log(
          `Connecting to ${amqp.redactedUri}, relaying into ${relayQueue(relay.database)}`,
        );
        return rabbitConfig(amqp, relay);
      },
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitModule {}
