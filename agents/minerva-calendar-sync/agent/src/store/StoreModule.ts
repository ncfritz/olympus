import { Module } from "@nestjs/common";
import { outboxConfig, type OutboxConfigType } from "../config/configuration";
import { CALENDAR_BUSY_INCLUSION_STORE } from "./calendarBusyInclusionStore";
import { CALENDAR_COLOR_STORE } from "./calendarColorStore";
import { CALENDAR_ENABLEMENT_STORE } from "./calendarEnablementStore";
import { EVENT_STORE } from "./eventStore";
import { OUTBOX_ENABLED, OUTBOX_STORE } from "./outboxStore";
import { PrismaCalendarBusyInclusionStore } from "./prisma/PrismaCalendarBusyInclusionStore";
import { PrismaCalendarColorStore } from "./prisma/PrismaCalendarColorStore";
import { PrismaCalendarEnablementStore } from "./prisma/PrismaCalendarEnablementStore";
import { PrismaEventStore } from "./prisma/PrismaEventStore";
import { PrismaOutboxStore } from "./prisma/PrismaOutboxStore";
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
    {
      provide: OUTBOX_ENABLED,
      useFactory: (outbox: OutboxConfigType) => outbox.enabled,
      inject: [outboxConfig.KEY],
    },
    PrismaEventStore,
    { provide: EVENT_STORE, useExisting: PrismaEventStore },
    PrismaOutboxStore,
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxStore },
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
    CALENDAR_COLOR_STORE,
    CALENDAR_ENABLEMENT_STORE,
    SYNCED_CALENDAR_STORE,
    CALENDAR_BUSY_INCLUSION_STORE,
    SYNC_RUN_STORE,
  ],
})
export class StoreModule {}
