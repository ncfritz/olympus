import { ListMailTrainingExamplesResponse } from "@ncfritz/olympus-model";
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
  MAX_TRAINING_PAGE,
  MailTrainingService,
} from "../services/MailTrainingService";

@Controller({ version: "1" })
export class ListMailTrainingExamplesController {
  constructor(private readonly training: MailTrainingService) {}

  @Get("/mail/training/examples")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists an account's messages as training examples",
    description:
      "For the mail classifier (ADR 0030, Label kinds): a page of the account's messages by Gmail ID, each with its metadata (never its text) and its labels as targets. A topical label is a topic; a state counts as its family; a retired label counts as what it merges into; system labels and stars are never targets. Pass the answer's `nextCursor` as `after` for the next page.",
    operationId: "ListMailTrainingExamples",
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
    description:
      "Only messages after this Gmail ID: the last page's nextCursor",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: `How many examples, 1 to ${MAX_TRAINING_PAGE}; 1000 by default`,
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of examples.",
    type: ListMailTrainingExamplesResponse,
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
    @Query("limit", new DefaultValuePipe(1000), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const body: ListMailTrainingExamplesResponse =
      await this.training.listExamples(accountId, after, limit);
    response.status(HttpStatus.OK).send(body);
  }
}
