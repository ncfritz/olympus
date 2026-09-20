import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CalendarAuthService } from "../services/CalendarAuthService";
import { AvailableCalendarDto } from "../dto/AvailableCalendarDto";
import { CalendarAccountStatusDto } from "../dto/CalendarAccountStatusDto";
import { NewAccountAuthStatusDto } from "../dto/NewAccountAuthStatusDto";
import { StartNewAccountAuthDto } from "../dto/StartNewAccountAuthDto";
import { StartNewAccountAuthResponseDto } from "../dto/StartNewAccountAuthResponseDto";
import { StartReauthResponseDto } from "../dto/StartReauthResponseDto";

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
  @ApiOkResponse({
    type: StartNewAccountAuthResponseDto,
    description: "A URL to open in a browser to authorize a new account",
  })
  startNewAccountAuth(
    @Body() body: StartNewAccountAuthDto,
  ): Promise<StartNewAccountAuthResponseDto> {
    return this.service.startNewAccountAuth(body.provider);
  }

  @Get("new/:transactionId")
  @ApiOkResponse({ type: NewAccountAuthStatusDto })
  @ApiNotFoundResponse({ description: "No such new-account authorization" })
  getNewAccountAuthStatus(
    @Param("transactionId") transactionId: string,
  ): NewAccountAuthStatusDto {
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
  @ApiOkResponse({
    type: StartReauthResponseDto,
    description: "A URL to open in a browser to (re-)grant access",
  })
  @ApiNotFoundResponse({
    description: "No configured calendar uses that account label",
  })
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
  @ApiNotFoundResponse({
    description:
      "No configured calendar uses that account label, or it hasn't signed in yet",
  })
  listAvailableCalendars(
    @Param("accountLabel") accountLabel: string,
    @Query("provider") provider?: "google" | "microsoft",
  ): Promise<AvailableCalendarDto[]> {
    return this.service.listAvailableCalendars(accountLabel, provider);
  }
}
