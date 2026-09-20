import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { StoreModule } from "../store/StoreModule";
import { SyncModule } from "../sync/SyncModule";
import { OutboxController } from "./controllers/OutboxController";
import { OutboxDispatcherService } from "./services/OutboxDispatcherService";

export const DEFAULT_EXCHANGE = "calendar.events";

/**
 * The publish-status read/admin API (OutboxController, backed by
 * OutboxStore) is always registered — the Publish page needs it to render
 * an honest "not configured" state even when outbound sync is off.
 *
 * The RabbitMQ connection and OutboxDispatcherService are the part that's
 * conditional: registers nothing — not even a connection attempt — unless
 * RABBITMQ_URL is actually set. Unlike WebhookNotifier's runtime no-op (that
 * one just skips its own logic if WEBHOOK_BASE_URL is missing), this brings
 * in a whole external module that opens and maintains a connection, so it's
 * gated one level up, at module registration, where "unconfigured" can mean
 * "never even tries to connect" rather than "connects, then no-ops".
 */
@Module({})
export class OutboxModule {
  static register(): DynamicModule {
    const rabbitMqImports = process.env.RABBITMQ_URL
      ? [
          RabbitMQModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              uri: config.getOrThrow<string>("RABBITMQ_URL"),
              exchanges: [
                {
                  name: config.get("RABBITMQ_EXCHANGE", DEFAULT_EXCHANGE),
                  type: "topic",
                },
              ],
              // Don't block Nest bootstrap if the broker happens to be
              // unreachable right when this process starts — the underlying
              // amqp-connection-manager keeps retrying in the background,
              // and outbox rows simply queue up in Postgres until it connects.
              connectionInitOptions: { wait: false },
              defaultPublishOptions: { persistent: true },
            }),
          }),
        ]
      : [];

    return {
      module: OutboxModule,
      imports: [StoreModule, SyncModule, ...rabbitMqImports],
      controllers: [OutboxController],
      providers: process.env.RABBITMQ_URL ? [OutboxDispatcherService] : [],
    };
  }
}
