import { Injectable } from "@nestjs/common";
import { EventOverride as EventOverrideRow } from "@prisma/client";
import { AvailabilityStatus, EventOverride } from "../../domain/availability";
import { EventOverrideStore } from "../event-override-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaEventOverrideStore implements EventOverrideStore {
  constructor(private readonly prisma: PrismaService) {}

  async setOverride(eventId: string, status: AvailabilityStatus): Promise<EventOverride> {
    const row = await this.prisma.eventOverride.upsert({
      where: { eventId },
      create: { eventId, status },
      update: { status },
    });
    return fromRow(row);
  }

  async clearOverride(eventId: string): Promise<void> {
    await this.prisma.eventOverride.deleteMany({ where: { eventId } });
  }

  async getOverride(eventId: string): Promise<EventOverride | null> {
    const row = await this.prisma.eventOverride.findUnique({ where: { eventId } });
    return row ? fromRow(row) : null;
  }

  async listOverrides(eventIds: string[]): Promise<EventOverride[]> {
    if (eventIds.length === 0) return [];
    const rows = await this.prisma.eventOverride.findMany({ where: { eventId: { in: eventIds } } });
    return rows.map(fromRow);
  }
}

function fromRow(row: EventOverrideRow): EventOverride {
  return { eventId: row.eventId, status: row.status as AvailabilityStatus };
}
