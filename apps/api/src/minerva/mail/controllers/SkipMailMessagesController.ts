import {
  SkipMailMessagesRequest,
  SkipMailMessagesResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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
export class SkipMailMessagesController {
  constructor(private readonly inbox: MailInboxService) {}

  @Post("/mail/account/:accountId/inbox/skip")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Skips messages' suggestions for now",
    description:
      "The inbox's skip (docs/plans/email-management phase 5): the messages are recorded as skipped, out of To review; Gmail is not changed.",
    operationId: "SkipMailMessages",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiBody({
    type: SkipMailMessagesRequest,
    required: true,
    description: "Input for the SkipMailMessages operation",
  })
  @ApiOkResponse({
    description: "The skips recorded.",
    type: SkipMailMessagesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account of the caller's.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: SkipMailMessagesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: SkipMailMessagesResponse = await this.inbox.skip(
      user.userId,
      accountId,
      request,
    );
    response.status(HttpStatus.OK).send(body);
  }
}
