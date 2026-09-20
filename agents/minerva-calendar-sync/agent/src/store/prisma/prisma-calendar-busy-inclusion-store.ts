import { Injectable } from "@nestjs/common";
import { CalendarBusyInclusionStore } from "../calendar-busy-inclusion-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaCalendarBusyInclusionStore implements CalendarBusyInclusionStore {
  constructor(private readonly prisma: PrismaService) {}

  async listOverrides(): Promise<Record<string, boolean>> {
    const rows = await this.prisma.calendarBusyInclusion.findMany();
    return Object.fromEntries(rows.map((row) => [row.calendarId, row.includedInBusy]));
  }

  async setIncludedInBusy(calendarId: string, includedInBusy: boolean): Promise<void> {
    await this.prisma.calendarBusyInclusion.upsert({
      where: { calendarId },
      create: { calendarId, includedInBusy },
      update: { includedInBusy },
    });
  }
}
