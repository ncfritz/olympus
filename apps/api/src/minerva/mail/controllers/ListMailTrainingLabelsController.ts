import { ListMailTrainingLabelsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailTrainingService } from "../services/MailTrainingService";

@Controller({ version: "1" })
export class ListMailTrainingLabelsController {
  constructor(private readonly training: MailTrainingService) {}

  @Get("/mail/training/labels")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists the labels the classifier can suggest for an account",
    description:
      "For the mail classifier (ADR 0030, Label kinds): the account's topical labels, and its state families with each one's initial label, the label a message predicted in the family is given.",
    operationId: "ListMailTrainingLabels",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "The mail account",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description: "The topics and families.",
    type: ListMailTrainingLabelsResponse,
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
    @Query("accountId") accountId: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const body: ListMailTrainingLabelsResponse =
      await this.training.listLabels(accountId);
    response.status(HttpStatus.OK).send(body);
  }
}
