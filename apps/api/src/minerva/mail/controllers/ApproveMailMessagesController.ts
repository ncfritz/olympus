import {
  ApproveMailMessagesRequest,
  ApproveMailMessagesResponse,
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
export class ApproveMailMessagesController {
  constructor(private readonly inbox: MailInboxService) {}

  @Post("/mail/account/:accountId/inbox/approve")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Approves messages' suggested labels",
    description:
      "The inbox's approve (docs/plans/email-management phase 5): each message's user labels to add and remove, as the picker left them (the ticked suggestion, or amended), and optionally archive and mark read, for their whole threads with wholeThread. What Gmail needs changing is written as one batch, followed in the change log; each message in the inbox among them is recorded as approved (amended when its labels are not its ticked suggestion's), and undoing the batch takes that back. Labels made in the picker go in newLabels.",
    operationId: "ApproveMailMessages",
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
    type: ApproveMailMessagesRequest,
    required: true,
    description: "Input for the ApproveMailMessages operation",
  })
  @ApiOkResponse({
    description: "The approvals recorded, and the batch writing them.",
    type: ApproveMailMessagesResponse,
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
    @Body() request: ApproveMailMessagesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ApproveMailMessagesResponse = await this.inbox.approve(
      user.userId,
      accountId,
      request,
    );
    response.status(HttpStatus.OK).send(body);
  }
}
