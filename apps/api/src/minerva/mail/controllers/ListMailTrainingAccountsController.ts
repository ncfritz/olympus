import { ListMailTrainingAccountsResponse } from "@ncfritz/olympus-model";
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
import { MailTrainingService } from "../services/MailTrainingService";

@Controller({ version: "1" })
export class ListMailTrainingAccountsController {
  constructor(private readonly training: MailTrainingService) {}

  @Get("/mail/training/accounts")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists the mail accounts the classifier trains for",
    description:
      "For the mail classifier (ADR 0030, docs/plans/email-management phase 3): every mail account, by address, each trained on its own.",
    operationId: "ListMailTrainingAccounts",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The accounts.",
    type: ListMailTrainingAccountsResponse,
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
    const body: ListMailTrainingAccountsResponse = {
      accounts: await this.training.listAccounts(),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
