import { Injectable } from "@nestjs/common";
import { SyncedCalendarConfig } from "../../sync/syncedCalendarConfig";
import { SyncedCalendarStore } from "../syncedCalendarStore";
import { PrismaService } from "./PrismaService";

@Injectable()
export class PrismaSyncedCalendarStore implements SyncedCalendarStore {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<SyncedCalendarConfig[]> {
    const rows = await this.prisma.syncedCalendar.findMany();
    return rows.map((row) => ({
      provider: row.provider as "google",
      accountLabel: row.accountLabel,
      calendarId: row.calendarId,
      source: row.source,
      enablePush: row.enablePush,
    }));
  }

  async add(calendar: SyncedCalendarConfig): Promise<void> {
    await this.prisma.syncedCalendar.create({ data: calendar });
  }

  async remove(calendarId: string): Promise<void> {
    await this.prisma.syncedCalendar.deleteMany({ where: { calendarId } });
  }
}
