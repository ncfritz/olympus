import { Injectable } from "@nestjs/common";
import { OverrideBlock as OverrideBlockRow } from "@prisma/client";
import { AvailabilityStatus, OverrideBlock } from "../../domain/availability";
import { OverrideBlockStore } from "../override-block-store";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaOverrideBlockStore implements OverrideBlockStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(block: Omit<OverrideBlock, "id">): Promise<OverrideBlock> {
    const row = await this.prisma.overrideBlock.create({
      data: {
        startTime: new Date(block.startTime),
        endTime: new Date(block.endTime),
        status: block.status,
        label: block.label,
      },
    });
    return fromRow(row);
  }

  async updateStatus(id: string, status: AvailabilityStatus): Promise<OverrideBlock | null> {
    const existing = await this.prisma.overrideBlock.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.prisma.overrideBlock.update({ where: { id }, data: { status } });
    return fromRow(row);
  }

  async listOverlapping(start: string, end: string): Promise<OverrideBlock[]> {
    const rows = await this.prisma.overrideBlock.findMany({
      where: {
        startTime: { lt: new Date(end) },
        endTime: { gt: new Date(start) },
      },
    });
    return rows.map(fromRow);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.overrideBlock.deleteMany({ where: { id } });
  }
}

function fromRow(row: OverrideBlockRow): OverrideBlock {
  return {
    id: row.id,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    status: row.status as AvailabilityStatus,
    label: row.label,
  };
}
