import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OutboxRecordDto } from "./outbox-record.dto";

/** Backs the "Publish status" row in the Events page's event detail drawer. */
export class EventPublishStatusDto {
  @ApiProperty({
    description:
      "Whether outbound sync is configured at all (RABBITMQ_URL set)",
  })
  enabled: boolean;

  @ApiPropertyOptional({
    type: OutboxRecordDto,
    nullable: true,
    description:
      "The most recent outbox row for this event, or null if it's never been queued (e.g. it predates outbound sync being enabled)",
  })
  latest: OutboxRecordDto | null;
}
