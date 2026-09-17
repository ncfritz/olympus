import { Injectable } from "@nestjs/common";
import { CalendarColorStore } from "../calendar-color-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaCalendarColorStore implements CalendarColorStore {
  constructor(private readonly prisma: PrismaService) {}

  async listColors(): Promise<Record<string, string>> {
    const rows = await this.prisma.calendarColor.findMany();
    return Object.fromEntries(rows.map((row) => [row.source, row.color]));
  }

  async setColor(source: string, color: string): Promise<void> {
    await this.prisma.calendarColor.upsert({
      where: { source },
      create: { source, color },
      update: { color },
    });
  }
}
