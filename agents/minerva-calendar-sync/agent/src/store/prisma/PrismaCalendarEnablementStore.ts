import { Injectable } from "@nestjs/common";
import { CalendarEnablementStore } from "../calendarEnablementStore";
import { PrismaService } from "./PrismaService";

@Injectable()
export class PrismaCalendarEnablementStore implements CalendarEnablementStore {
  constructor(private readonly prisma: PrismaService) {}

  async listOverrides(): Promise<Record<string, boolean>> {
    const rows = await this.prisma.calendarEnablement.findMany();
    return Object.fromEntries(rows.map((row) => [row.calendarId, row.enabled]));
  }

  async setEnabled(calendarId: string, enabled: boolean): Promise<void> {
    await this.prisma.calendarEnablement.upsert({
      where: { calendarId },
      create: { calendarId, enabled },
      update: { enabled },
    });
  }
}
