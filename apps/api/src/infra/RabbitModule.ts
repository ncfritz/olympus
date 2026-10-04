import {
  BATCH_JOB_TRIGGER_EXCHANGE,
  BATCH_JOB_WORKFLOW_EXCHANGE,
  CALENDAR_EVENTS_EXCHANGE,
  CONTENT_TRIGGER_EXCHANGE,
  declare,
  DOWNLOAD_TRIGGER_EXCHANGE,
  MEDIA_TRIGGER_EXCHANGE,
  METADATA_JOB_TRIGGER_EXCHANGE,
  NOTIFICATIONS_TRIGGER_EXCHANGE,
  SEARCH_EXECUTION_TRIGGER_EXCHANGE,
  WEATHER_STATION_REPORTS_EXCHANGE,
} from "@ncfritz/olympus-messages";
import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Logger, Module } from "@nestjs/common";
import { amqpConfig, AmqpConfigType } from "../config/configuration";
import {
  CALENDAR_EVENTS_CHANNEL,
  CALENDAR_EVENTS_DEAD_LETTER_QUEUE,
  CALENDAR_EVENTS_PREFETCH,
  CALENDAR_EVENTS_QUEUE,
  CALENDAR_EVENTS_RETRY_QUEUES,
} from "../minerva/calendars/messaging";

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
            WEATHER_STATION_REPORTS_EXCHANGE,
            // And the one it consumes, so its queue can be bound before
            // the calendar sync agent has started.
            CALENDAR_EVENTS_EXCHANGE,
          ),
          channels: {
            [CALENDAR_EVENTS_CHANNEL]: {
              prefetchCount: CALENDAR_EVENTS_PREFETCH,
            },
          },
          // Where the calendar events consumer puts what it can never
          // write (ADR 0028), and the delay queues it retries through,
          // each returning a message to the events queue when its time is
          // up.
          queues: [
            {
              name: CALENDAR_EVENTS_DEAD_LETTER_QUEUE,
              options: { durable: true },
            },
            ...CALENDAR_EVENTS_RETRY_QUEUES.map((retry) => ({
              name: retry.name,
              options: {
                durable: true,
                messageTtl: retry.delayMs,
                deadLetterExchange: "",
                deadLetterRoutingKey: CALENDAR_EVENTS_QUEUE,
              },
            })),
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
