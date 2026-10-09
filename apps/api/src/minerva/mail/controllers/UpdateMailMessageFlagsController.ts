import {
  UpdateMailMessageFlagsRequest,
  UpdateMailMessageFlagsResponse,
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
export class UpdateMailMessageFlagsController {
  constructor(private readonly inbox: MailInboxService) {}

  @Post("/mail/account/:accountId/inbox/flags")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Archives messages or marks them read",
    description:
      "The inbox's Archive and Mark read (docs/plans/email-management phase 5), deciding nothing about their suggestions: the messages (and their threads, with wholeThread) that Minerva has in the inbox or unread are written to Gmail as one batch, which the change log can undo.",
    operationId: "UpdateMailMessageFlags",
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
    type: UpdateMailMessageFlagsRequest,
    required: true,
    description: "Input for the UpdateMailMessageFlags operation",
  })
  @ApiOkResponse({
    description: "The batch, if anything needed changing.",
    type: UpdateMailMessageFlagsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account of the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The mailbox is linked for reading only.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "Writes to Gmail are turned off, or the agent is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: UpdateMailMessageFlagsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: UpdateMailMessageFlagsResponse = await this.inbox.updateFlags(
      user.userId,
      accountId,
      request,
    );
    response.status(HttpStatus.OK).send(body);
  }
}
