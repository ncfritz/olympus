import { Module } from "@nestjs/common";
import { CALENDAR_COLOR_STORE } from "./calendar-color-store";
import { EVENT_OVERRIDE_STORE } from "./event-override-store";
import { EVENT_STORE } from "./event-store";
import { OVERRIDE_BLOCK_STORE } from "./override-block-store";
import { PrismaCalendarColorStore } from "./prisma/prisma-calendar-color-store";
import { PrismaEventOverrideStore } from "./prisma/prisma-event-override-store";
import { PrismaEventStore } from "./prisma/prisma-event-store";
import { PrismaOverrideBlockStore } from "./prisma/prisma-override-block-store";
import { PrismaService } from "./prisma/prisma.service";

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
  ],
  exports: [EVENT_STORE, EVENT_OVERRIDE_STORE, OVERRIDE_BLOCK_STORE, CALENDAR_COLOR_STORE],
})
export class StoreModule {}
