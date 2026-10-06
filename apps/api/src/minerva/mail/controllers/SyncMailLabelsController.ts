import {
  SyncMailLabelsRequest,
  SyncMailLabelsResponse,
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
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailSyncService } from "../services/MailSyncService";

@Controller({ version: "1" })
export class SyncMailLabelsController {
  constructor(private readonly sync: MailSyncService) {}

  @Post("/mail/account/:accountId/labels/sync")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Brings an account's labels into step with Gmail's",
    description:
      "For the mail agent's reconcile with Gmail (docs/plans/email-management phase 1b): Gmail's labels.list for the mailbox. Each of the account's labels gets its Gmail label ID by name (categories by their ID), user labels made in Gmail since the import are added, and those Gmail no longer has are named in the answer and kept, with their kinds.",
    operationId: "SyncMailLabels",
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
    type: SyncMailLabelsRequest,
    required: true,
    description: "Input for the SyncMailLabels operation",
  })
  @ApiOkResponse({ description: "What changed.", type: SyncMailLabelsResponse })
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
    @Body() request: SyncMailLabelsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: SyncMailLabelsResponse = await this.sync.syncLabels(
      accountId,
      request?.labels,
    );
    response.status(HttpStatus.OK).send(body);
  }
}
