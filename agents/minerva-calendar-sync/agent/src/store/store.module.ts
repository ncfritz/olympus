import { Module } from "@nestjs/common";
import { EVENT_STORE } from "./event-store";
import { PrismaEventStore } from "./prisma/prisma-event-store";
import { PrismaService } from "./prisma/prisma.service";

@Module({
  providers: [
    PrismaService,
    PrismaEventStore,
    { provide: EVENT_STORE, useExisting: PrismaEventStore },
  ],
  exports: [EVENT_STORE],
})
export class StoreModule {}
