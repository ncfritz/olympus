import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OutboxRecordDto {
  @ApiProperty({ description: "Outbox row id" })
  id: string;

  @ApiProperty({ description: "The canonical event id (source:uid) this row describes" })
  eventId: string;

  @ApiProperty({ description: "The source label this row's event belongs to" })
  source: string;

  @ApiProperty({ description: "Lifted from the row's payload for display" })
  subject: string;

  @ApiProperty({ enum: ["upsert", "delete", "backfill"] })
  action: string;

  @ApiProperty({ enum: ["pending", "sent", "failed"] })
  status: string;

  @ApiProperty({ description: "How many delivery attempts have been made" })
  attempts: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastError: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  sentAt: string | null;
}
