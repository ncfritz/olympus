import {
  UpdateMailAccountSyncRequest,
  UpdateMailAccountSyncResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
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
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailSyncService } from "../services/MailSyncService";

@Controller({ version: "1" })
export class UpdateMailAccountSyncController {
  constructor(private readonly sync: MailSyncService) {}

  @Put("/mail/account/:accountId/sync")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Records a finished reconcile with Gmail",
    description:
      "For the mail agent (docs/plans/email-management phase 1b): the historyId the reconcile began at, where history polling carries on from, and Gmail's own totals for the mailbox (getProfile), which M2 compares with Minerva's.",
    operationId: "UpdateMailAccountSync",
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
    type: UpdateMailAccountSyncRequest,
    required: true,
    description: "Input for the UpdateMailAccountSync operation",
  })
  @ApiOkResponse({
    description: "The account.",
    type: UpdateMailAccountSyncResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("accountId") accountId: string,
    @Body() request: UpdateMailAccountSyncRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: UpdateMailAccountSyncResponse = {
      mailAccount: await this.sync.recordSync(accountId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
