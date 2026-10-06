import { ListMailSyncAccountsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailSyncService } from "../services/MailSyncService";

@Controller({ version: "1" })
export class ListMailSyncAccountsController {
  constructor(private readonly sync: MailSyncService) {}

  @Get("/mail/sync/accounts")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists the mail accounts linked to Gmail",
    description:
      "For the mail agent (docs/plans/email-management phase 1b): every account linked to Gmail, by address, with the historyId its history polling carries on from (absent until the first reconcile).",
    operationId: "ListMailSyncAccounts",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The linked accounts.",
    type: ListMailSyncAccountsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const body: ListMailSyncAccountsResponse = {
      accounts: await this.sync.listLinked(),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
