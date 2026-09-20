import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CalendarAuthService } from "./calendar-auth.service";
import { AvailableCalendarDto } from "./dto/available-calendar.dto";
import { CalendarAccountStatusDto } from "./dto/calendar-account-status.dto";
import { NewAccountAuthStatusDto } from "./dto/new-account-auth-status.dto";
import { StartNewAccountAuthDto } from "./dto/start-new-account-auth.dto";
import { StartNewAccountAuthResponseDto } from "./dto/start-new-account-auth-response.dto";
import { StartReauthResponseDto } from "./dto/start-reauth-response.dto";

@ApiBearerAuth()
@ApiTags("calendar-auth")
@Controller("calendar-accounts")
export class CalendarAuthController {
  constructor(private readonly service: CalendarAuthService) {}

  @Get()
  @ApiOkResponse({ type: CalendarAccountStatusDto, isArray: true })
  list(): Promise<CalendarAccountStatusDto[]> {
    return this.service.listStatuses();
  }

  @Post("new")
  @ApiOkResponse({ type: StartNewAccountAuthResponseDto, description: "A URL to open in a browser to authorize a new account" })
  startNewAccountAuth(@Body() body: StartNewAccountAuthDto): Promise<StartNewAccountAuthResponseDto> {
    return this.service.startNewAccountAuth(body.provider);
  }

  @Get("new/:transactionId")
  @ApiOkResponse({ type: NewAccountAuthStatusDto })
  @ApiNotFoundResponse({ description: "No such new-account authorization" })
  getNewAccountAuthStatus(@Param("transactionId") transactionId: string): NewAccountAuthStatusDto {
    return this.service.getNewAccountAuthStatus(transactionId);
  }

  @Post(":accountLabel/reauth")
  @ApiQuery({
    name: "provider",
    enum: ["google", "microsoft"],
    required: false,
    description:
      "Disambiguates which provider's account to reauthorize when the same accountLabel is connected under more than one — omit only when it's known not to collide.",
  })
  @ApiOkResponse({ type: StartReauthResponseDto, description: "A URL to open in a browser to (re-)grant access" })
  @ApiNotFoundResponse({ description: "No configured calendar uses that account label" })
  startReauth(
    @Param("accountLabel") accountLabel: string,
    @Query("provider") provider?: "google" | "microsoft",
  ): Promise<StartReauthResponseDto> {
    return this.service.startReauth(accountLabel, provider);
  }

  @Get(":accountLabel/available-calendars")
  @ApiQuery({
    name: "provider",
    enum: ["google", "microsoft"],
    required: false,
    description:
      "Disambiguates which provider's account to list calendars for when the same accountLabel is connected under more than one — omit only when it's known not to collide.",
  })
  @ApiOkResponse({ type: AvailableCalendarDto, isArray: true })
  @ApiNotFoundResponse({ description: "No configured calendar uses that account label, or it hasn't signed in yet" })
  listAvailableCalendars(
    @Param("accountLabel") accountLabel: string,
    @Query("provider") provider?: "google" | "microsoft",
  ): Promise<AvailableCalendarDto[]> {
    return this.service.listAvailableCalendars(accountLabel, provider);
  }
}
