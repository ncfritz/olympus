import { Module } from "@nestjs/common";
import { CALENDAR_BUSY_INCLUSION_STORE } from "./calendar-busy-inclusion-store";
import { CALENDAR_COLOR_STORE } from "./calendar-color-store";
import { CALENDAR_ENABLEMENT_STORE } from "./calendar-enablement-store";
import { EVENT_OVERRIDE_STORE } from "./event-override-store";
import { EVENT_STORE } from "./event-store";
import { OVERRIDE_BLOCK_STORE } from "./override-block-store";
import { PrismaCalendarBusyInclusionStore } from "./prisma/prisma-calendar-busy-inclusion-store";
import { PrismaCalendarColorStore } from "./prisma/prisma-calendar-color-store";
import { PrismaCalendarEnablementStore } from "./prisma/prisma-calendar-enablement-store";
import { PrismaEventOverrideStore } from "./prisma/prisma-event-override-store";
import { PrismaEventStore } from "./prisma/prisma-event-store";
import { PrismaOverrideBlockStore } from "./prisma/prisma-override-block-store";
import { PrismaService } from "./prisma/prisma.service";
import { PrismaSyncedCalendarStore } from "./prisma/prisma-synced-calendar-store";
import { PrismaSyncRunStore } from "./prisma/prisma-sync-run-store";
import { SYNCED_CALENDAR_STORE } from "./synced-calendar-store";
import { SYNC_RUN_STORE } from "./sync-run-store";

@Module({
  providers: [
    PrismaService,
    PrismaEventStore,
    { provide: EVENT_STORE, useExisting: PrismaEventStore },
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
    EVENT_STORE,
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
