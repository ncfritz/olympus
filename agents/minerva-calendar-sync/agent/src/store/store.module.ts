import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CALENDAR_BUSY_INCLUSION_STORE } from "./calendar-busy-inclusion-store";
import { CALENDAR_COLOR_STORE } from "./calendar-color-store";
import { CALENDAR_ENABLEMENT_STORE } from "./calendar-enablement-store";
import { EVENT_OVERRIDE_STORE } from "./event-override-store";
import { EVENT_STORE } from "./event-store";
import { OUTBOX_ENABLED, OUTBOX_STORE } from "./outbox-store";
import { OVERRIDE_BLOCK_STORE } from "./override-block-store";
import { PrismaCalendarBusyInclusionStore } from "./prisma/prisma-calendar-busy-inclusion-store";
import { PrismaCalendarColorStore } from "./prisma/prisma-calendar-color-store";
import { PrismaCalendarEnablementStore } from "./prisma/prisma-calendar-enablement-store";
import { PrismaEventOverrideStore } from "./prisma/prisma-event-override-store";
import { PrismaEventStore } from "./prisma/prisma-event-store";
import { PrismaOutboxStore } from "./prisma/prisma-outbox-store";
import { PrismaOverrideBlockStore } from "./prisma/prisma-override-block-store";
import { PrismaService } from "./prisma/prisma.service";
import { PrismaSyncedCalendarStore } from "./prisma/prisma-synced-calendar-store";
import { PrismaSyncRunStore } from "./prisma/prisma-sync-run-store";
import { SYNCED_CALENDAR_STORE } from "./synced-calendar-store";
import { SYNC_RUN_STORE } from "./sync-run-store";

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
      useFactory: (config: ConfigService) => Boolean(config.get<string>("RABBITMQ_URL")),
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
    { provide: CALENDAR_ENABLEMENT_STORE, useExisting: PrismaCalendarEnablementStore },
    PrismaSyncedCalendarStore,
    { provide: SYNCED_CALENDAR_STORE, useExisting: PrismaSyncedCalendarStore },
    PrismaCalendarBusyInclusionStore,
    { provide: CALENDAR_BUSY_INCLUSION_STORE, useExisting: PrismaCalendarBusyInclusionStore },
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
