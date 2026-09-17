import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AddCalendarDto {
  @ApiProperty({ description: "Which stored OAuth credential this calendar authorizes with — must already be a connected account" })
  @IsString()
  @IsNotEmpty()
  accountLabel: string;

  @ApiProperty({ description: "The provider's own calendar id, from GET /calendar-accounts/{accountLabel}/available-calendars" })
  @IsString()
  @IsNotEmpty()
  calendarId: string;

  @ApiProperty({ description: "The source label to write onto this calendar's event rows" })
  @IsString()
  @IsNotEmpty()
  source: string;
}
