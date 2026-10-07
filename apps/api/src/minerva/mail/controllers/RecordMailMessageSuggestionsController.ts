import {
  RecordMailMessageSuggestionsRequest,
  RecordMailMessageSuggestionsResponse,
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
import {
  MAX_MESSAGE_SUGGESTIONS,
  MAX_SCORED_MESSAGES,
  MailSuggestionService,
} from "../services/MailSuggestionService";

@Controller({ version: "1" })
export class RecordMailMessageSuggestionsController {
  constructor(private readonly suggestions: MailSuggestionService) {}

  @Put("/mail/account/:accountId/message-suggestions")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Records new mail's suggested labels",
    description: `For the mail agent (docs/plans/email-management phase 5): up to ${MAX_SCORED_MESSAGES} messages scored by the serving model as they arrived, each by Gmail ID with up to ${MAX_MESSAGE_SUGGESTIONS} labels by full name, best first, each with its score and whether it is ticked. Each message's suggestions replace what it had; a message with none was scored and nothing reached the floor. The message need not be stored yet. A label the mailbox does not have, or not the user's own, is skipped and counted.`,
    operationId: "RecordMailMessageSuggestions",
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
    type: RecordMailMessageSuggestionsRequest,
    required: true,
    description: "Input for the RecordMailMessageSuggestions operation",
  })
  @ApiOkResponse({
    description: "The suggestions were stored; some may have been skipped.",
    type: RecordMailMessageSuggestionsResponse,
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
    @Body() request: RecordMailMessageSuggestionsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: RecordMailMessageSuggestionsResponse =
      await this.suggestions.recordMessageSuggestions(accountId, request);
    response.status(HttpStatus.OK).send(body);
  }
}
