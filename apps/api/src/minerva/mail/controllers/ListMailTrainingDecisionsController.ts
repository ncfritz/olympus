import { ListMailTrainingDecisionsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
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
  MAX_DECISION_PAGE,
  MailTrainingService,
} from "../services/MailTrainingService";

@Controller({ version: "1" })
export class ListMailTrainingDecisionsController {
  constructor(private readonly training: MailTrainingService) {}

  @Get("/mail/training/decisions")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists approvals in the inbox to learn from",
    description:
      "For the mail classifier (docs/plans/email-management phase 5): the account's approvals in the inbox in the order they were made, after the cursor, each with its message as a training example (metadata only, its labels now as targets, `decision` saying whether it was amended) and whether it is `ready`: the batch writing its labels has finished, or none was needed. Skips are left out. Learn the ready ones in order and keep the `cursor` of the last learned; pass it as `after` next time.",
    operationId: "ListMailTrainingDecisions",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "The mail account",
    type: String,
    required: true,
  })
  @ApiQuery({
    name: "after",
    description: "Only decisions after this cursor: a decision's `cursor`",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: `How many decisions, 1 to ${MAX_DECISION_PAGE}; 500 by default`,
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of approvals.",
    type: ListMailTrainingDecisionsResponse,
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
    @Query("after") after: string | undefined,
    @Query("limit", new DefaultValuePipe(500), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const body: ListMailTrainingDecisionsResponse =
      await this.training.listDecisions(accountId, after, limit);
    response.status(HttpStatus.OK).send(body);
  }
}
