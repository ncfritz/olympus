import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CALENDAR_BUSY_INCLUSION_STORE } from "./calendarBusyInclusionStore";
import { CALENDAR_COLOR_STORE } from "./calendarColorStore";
import { CALENDAR_ENABLEMENT_STORE } from "./calendarEnablementStore";
import { EVENT_OVERRIDE_STORE } from "./eventOverrideStore";
import { EVENT_STORE } from "./eventStore";
import { OUTBOX_ENABLED, OUTBOX_STORE } from "./outboxStore";
import { OVERRIDE_BLOCK_STORE } from "./overrideBlockStore";
import { PrismaCalendarBusyInclusionStore } from "./prisma/PrismaCalendarBusyInclusionStore";
import { PrismaCalendarColorStore } from "./prisma/PrismaCalendarColorStore";
import { PrismaCalendarEnablementStore } from "./prisma/PrismaCalendarEnablementStore";
import { PrismaEventOverrideStore } from "./prisma/PrismaEventOverrideStore";
import { PrismaEventStore } from "./prisma/PrismaEventStore";
import { PrismaOutboxStore } from "./prisma/PrismaOutboxStore";
import { PrismaOverrideBlockStore } from "./prisma/PrismaOverrideBlockStore";
import { PrismaService } from "./prisma/PrismaService";
import { PrismaSyncedCalendarStore } from "./prisma/PrismaSyncedCalendarStore";
import { PrismaSyncRunStore } from "./prisma/PrismaSyncRunStore";
import { SYNCED_CALENDAR_STORE } from "./syncedCalendarStore";
import { SYNC_RUN_STORE } from "./syncRunStore";

@Module({
  providers: [
    PrismaService,
    // Whether outbound sync (see OutboxModule) is configured at all —
    // PrismaEventStore reads this to decide whether to write outbox rows in
    // the first place, so it stays a plain flag here rather than living in
    // OutboxModule, which PrismaEventStore can't depend on without a
    // circular import (OutboxModule already depends on StoreModule).
    //
    // Deliberately a `useFactory` reading ConfigService, not a `useValue`
    // reading `process.env` directly: this file's own `@Module()` decorator
    // runs at *import* time — while app.module.ts is still resolving its
    // own imports, strictly before it reaches its `ConfigModule.forRoot()`
    // call — so a direct `process.env.RABBITMQ_URL` read here would only
    // ever see a variable already set in the OS environment, never one
    // coming from the `.env` file dotenv loads. A factory provider defers
    // this read to Nest's DI-instantiation phase, well after bootstrap has
    // finished composing the module graph, sidestepping that ordering
    // entirely.
    {
      provide: OUTBOX_ENABLED,
      useFactory: (config: ConfigService) =>
        Boolean(config.get<string>("RABBITMQ_URL")),
      inject: [ConfigService],
    },
    PrismaEventStore,
    { provide: EVENT_STORE, useExisting: PrismaEventStore },
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
    PrismaEventOverrideStore,
    { provide: EVENT_OVERRIDE_STORE, useExisting: PrismaEventOverrideStore },
    PrismaOverrideBlockStore,
    { provide: OVERRIDE_BLOCK_STORE, useExisting: PrismaOverrideBlockStore },
    PrismaCalendarColorStore,
    { provide: CALENDAR_COLOR_STORE, useExisting: PrismaCalendarColorStore },
    PrismaCalendarEnablementStore,
    {
      provide: CALENDAR_ENABLEMENT_STORE,
      useExisting: PrismaCalendarEnablementStore,
    },
    PrismaSyncedCalendarStore,
    { provide: SYNCED_CALENDAR_STORE, useExisting: PrismaSyncedCalendarStore },
    PrismaCalendarBusyInclusionStore,
    {
      provide: CALENDAR_BUSY_INCLUSION_STORE,
      useExisting: PrismaCalendarBusyInclusionStore,
    },
    PrismaSyncRunStore,
    { provide: SYNC_RUN_STORE, useExisting: PrismaSyncRunStore },
  ],
  exports: [
    PrismaService,
    EVENT_STORE,
    OUTBOX_STORE,
    OUTBOX_ENABLED,
    EVENT_OVERRIDE_STORE,
    OVERRIDE_BLOCK_STORE,
    CALENDAR_COLOR_STORE,
    CALENDAR_ENABLEMENT_STORE,
    SYNCED_CALENDAR_STORE,
    CALENDAR_BUSY_INCLUSION_STORE,
    SYNC_RUN_STORE,
  ],
})
export class StoreModule {}
