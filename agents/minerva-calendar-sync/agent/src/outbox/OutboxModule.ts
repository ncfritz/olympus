import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { DynamicModule, Logger, Module } from "@nestjs/common";
import { outboxConfig, type OutboxConfigType } from "../config/configuration";
import { StoreModule } from "../store/StoreModule";
import { SyncModule } from "../sync/SyncModule";
import { OutboxController } from "./controllers/OutboxController";
import { OutboxDispatcherService } from "./services/OutboxDispatcherService";

/** The topic exchange event changes are published to (routing keys `event.<action>`). */
export const CALENDAR_EVENTS_EXCHANGE = "calendar.events";

/**
 * The publish-status read/admin API (OutboxController, backed by
 * OutboxStore) is always registered — the Publish page needs it to render
 * an honest "not configured" state even when outbound sync is off.
 *
 * The RabbitMQ connection and OutboxDispatcherService are the part that's
 * conditional: registers nothing — not even a connection attempt — unless
 * OUTBOX_ENABLED is "true". Unlike WebhookNotifier's runtime no-op (that
 * one just skips its own logic if WEBHOOK_BASE_URL is missing), this brings
 * in a whole external module that opens and maintains a connection, so it's
 * gated one level up, at module registration, where "unconfigured" can mean
 * "never even tries to connect" rather than "connects, then no-ops".
 */
@Module({})
export class OutboxModule {
  /** @param enabled OUTBOX_ENABLED, read by AppModule when it is loaded */
  static register(enabled: boolean): DynamicModule {
    const rabbitMqImports = enabled
      ? [
          RabbitMQModule.forRootAsync({
            inject: [outboxConfig.KEY],
            useFactory: (outbox: OutboxConfigType) => {
              new Logger(OutboxModule.name).log(
                `Publishing to ${outbox.amqp.redactedUri}`,
              );
              return {
                uri: outbox.amqp.uri,
                exchanges: [{ name: CALENDAR_EVENTS_EXCHANGE, type: "topic" }],
                // Don't block Nest bootstrap if the broker happens to be
                // unreachable right when this process starts — the underlying
                // amqp-connection-manager keeps retrying in the background,
                // and outbox rows simply queue up in the database until it
                // connects.
                connectionInitOptions: { wait: false },
                defaultPublishOptions: { persistent: true },
              };
            },
          }),
        ]
      : [];

    return {
      module: OutboxModule,
      imports: [StoreModule, SyncModule, ...rabbitMqImports],
      controllers: [OutboxController],
      providers: enabled ? [OutboxDispatcherService] : [],
    };
  }
}
