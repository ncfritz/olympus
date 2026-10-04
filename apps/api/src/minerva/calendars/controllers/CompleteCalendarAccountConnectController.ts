import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { type Response } from "express";
import { Public } from "../../../auth/authDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

/**
 * Where the provider sends the browser back from a calendar account
 * sign-in (ADR 0028). The browser carries no access token here; the
 * sign-in is found by its state, which only the user who started it was
 * given, is single use and expires.
 */
@Controller({ version: "1" })
export class CompleteCalendarAccountConnectController {
  constructor(private readonly accounts: CalendarAccountService) {}

  @Get("/calendar-accounts/callback/:provider")
  @Public()
  @ApiOperation({
    summary: "Completes a calendar account sign-in",
    description:
      "The provider's redirect. Redeems the sign-in through the sync agent, links the account to the user who started it unless it is another user's, and sends the browser back to the site page with the outcome: calendarAccount=connected (with accountId), cancelled, expired, refused (with reason) or failed.",
    operationId: "CompleteCalendarAccountConnect",
    tags: ["Calendar Accounts"],
  })
  @ApiParam({ name: "provider", required: true })
  @ApiResponse({ status: 302, description: "Back to the site page." })
  @ApiResponse({
    status: 400,
    description:
      "No sign-in is waiting for this state, so there is nowhere safe to send the browser.",
  })
  async handle(
    @Param("provider") provider: string,
    @Query() query: Record<string, string>,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(await this.accounts.complete(provider, query));
  }
}
