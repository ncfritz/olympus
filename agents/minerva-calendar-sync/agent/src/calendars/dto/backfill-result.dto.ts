import { ApiProperty } from "@nestjs/swagger";

export class BackfillResultDto {
  @ApiProperty({ description: "How many of this calendar's events were enqueued for redelivery to the outbound broker" })
  enqueued: number;

  @ApiProperty({
    description:
      "True if this calendar has more non-deleted events than the backfill cap — only the most recent ones (by start time) were enqueued",
  })
  truncated: boolean;
}
