import { ApiProperty } from "@nestjs/swagger";

/** One calendar the provider reports for an account, whether or not it's already being synced. */
export class AvailableCalendarDto {
  @ApiProperty({ description: "The provider's own calendar id (e.g. \"primary\" or a shared calendar's id)" })
  id: string;

  @ApiProperty({ description: "The calendar's display name, as the provider shows it" })
  summary: string;

  @ApiProperty({ description: "Whether this calendar is already configured to sync" })
  alreadySynced: boolean;
}
