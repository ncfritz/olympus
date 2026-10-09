import { GetMailMessageContentResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailInboxService } from "../services/MailInboxService";

@Controller({ version: "1" })
export class GetMailMessageContentController {
  constructor(private readonly inbox: MailInboxService) {}

  @Get("/mail/account/:accountId/message/:gmailId/content")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Reads a message from Gmail to show it",
    description:
      "The inbox's Open message (docs/plans/email-management phase 5; ADR 0030): the message read live from Gmail by the mail agent, with its headers, its text and HTML bodies (each at most 1,000,000 characters) and what is attached (not the content). Nothing of it is stored, logged or cached (`Cache-Control: no-store`). The HTML is as sent, not sanitized: show it only in a sandboxed frame with remote content blocked.",
    operationId: "GetMailMessageContent",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiParam({
    name: "gmailId",
    description: "The message's Gmail ID",
    type: String,
  })
  @ApiOkResponse({
    description: "The message as Gmail has it now.",
    type: GetMailMessageContentResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      "No such mail account of the caller's, or Gmail has no such message.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The mailbox is not linked to Gmail.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "The mail agent is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Param("gmailId") gmailId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetMailMessageContentResponse = {
      content: await this.inbox.content(user.userId, accountId, gmailId),
    };
    response.status(HttpStatus.OK).set("Cache-Control", "no-store").send(body);
  }
}
