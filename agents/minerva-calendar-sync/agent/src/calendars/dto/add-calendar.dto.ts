import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class AddCalendarDto {
  // Required rather than inferred from accountLabel: the same email can be a
  // connected account under more than one provider (e.g. the same address
  // as both a Google Workspace and a Microsoft 365 identity), so accountLabel
  // alone doesn't uniquely resolve which stored credential this is.
  @ApiProperty({ description: "Which provider this calendar's account authorizes with", enum: ["google", "microsoft"] })
  @IsIn(["google", "microsoft"])
  provider: "google" | "microsoft";

  @ApiProperty({ description: "Which stored OAuth credential this calendar authorizes with — must already be a connected account for this provider" })
  @IsString()
  @IsNotEmpty()
  accountLabel: string;

  @ApiProperty({ description: "The provider's own calendar id, from GET /calendar-accounts/{accountLabel}/available-calendars?provider=..." })
  @IsString()
  @IsNotEmpty()
  calendarId: string;

  @ApiProperty({ description: "The source label to write onto this calendar's event rows" })
  @IsString()
  @IsNotEmpty()
  source: string;
}
