import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { type Response } from "express";
import { Public } from "../../../auth/authDecorators";
import { MailLinkService } from "../services/MailLinkService";

/**
 * Where Google sends the browser back from linking a mailbox. The browser
 * carries no access token here; the sign-in is found by its state, which
 * only the user who started it was given, is single use and expires.
 */
@Controller({ version: "1" })
export class CompleteMailAccountConnectController {
  constructor(private readonly links: MailLinkService) {}

  @Get("/mail/accounts/callback")
  @Public()
  @ApiOperation({
    summary: "Completes linking a mail account to Gmail",
    description:
      "Google's redirect, registered with the mail OAuth client. Redeems the sign-in through the mail agent, links the account when it is the mailbox's own, and sends the browser back to the site page with the outcome: mailAccount=connected (with accountId), cancelled, expired, refused (with reason another-account or owned) or failed.",
    operationId: "CompleteMailAccountConnect",
    tags: ["Mail"],
  })
  @ApiResponse({ status: 302, description: "Back to the site page." })
  @ApiResponse({
    status: 400,
    description:
      "No sign-in is waiting for this state, so there is nowhere safe to send the browser.",
  })
  async handle(
    @Query() query: Record<string, string>,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(await this.links.complete(query));
  }
}
