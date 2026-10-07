import { ListMailInboxToScoreResponse } from "@ncfritz/olympus-model";
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
import {
  MAX_INBOX_TO_SCORE,
  MailTrainingService,
} from "../services/MailTrainingService";

@Controller({ version: "1" })
export class ListMailInboxToScoreController {
  constructor(private readonly training: MailTrainingService) {}

  @Get("/mail/training/inbox")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists the inbox's messages to score again",
    description: `For the mail classifier (docs/plans/email-management phase 5): the Gmail IDs of the account's messages in the inbox with nothing decided, newest first, at most ${MAX_INBOX_TO_SCORE}, to score again from their stored features when its model has learned (RecordMailMessageSuggestions).`,
    operationId: "ListMailInboxToScore",
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
    description: "The messages to score.",
    type: ListMailInboxToScoreResponse,
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
    const body: ListMailInboxToScoreResponse =
      await this.training.listInboxToScore(accountId);
    response.status(HttpStatus.OK).send(body);
  }
}
