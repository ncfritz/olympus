import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OutboxSourceStatsDto {
  @ApiProperty({ description: "The source label this row's stats are for" })
  source: string;

  @ApiPropertyOptional({
    description:
      "The configured calendar this source belongs to, if it's still configured",
    nullable: true,
    type: String,
  })
  calendarId: string | null;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  sent: number;

  @ApiProperty()
  failed: number;

  @ApiPropertyOptional({
    description:
      "createdAt of the oldest still-pending row — a growing age is the signal something downstream is stuck",
    nullable: true,
    type: String,
  })
  oldestPendingAt: string | null;
}

export class OutboxSummaryDto {
  @ApiProperty({
    description:
      "Whether outbound sync is configured at all (RABBITMQ_URL set)",
  })
  enabled: boolean;

  @ApiProperty({ type: OutboxSourceStatsDto, isArray: true })
  sources: OutboxSourceStatsDto[];
}
