import { ApiProperty } from "@nestjs/swagger";

export class CalendarStatusDto {
  @ApiProperty({ description: "Which CalendarProvider implementation this calendar uses" })
  provider: string;

  @ApiProperty({ description: "Which stored OAuth credential this calendar authorizes with" })
  accountLabel: string;

  @ApiProperty({ description: "The provider's own calendar id" })
  calendarId: string;

  @ApiProperty({ description: "The source label written onto this calendar's event rows" })
  source: string;

  @ApiProperty({ description: "True once at least one full sync has completed" })
  synced: boolean;
}
