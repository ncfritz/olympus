import {
  CreateMailSuggestionsRequest,
  CreateMailSuggestionsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MAX_SUGGESTIONS,
  MailSuggestionService,
} from "../services/MailSuggestionService";

@Controller({ version: "1" })
export class CreateMailSuggestionsController {
  constructor(private readonly suggestions: MailSuggestionService) {}

  @Post("/mail/suggestion-run/:runId/suggestions")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Adds a batch of suggestions to a building run",
    description: `For the mail classifier (docs/plans/email-management phase 4): up to ${MAX_SUGGESTIONS} suggestions, each a message by Gmail ID and a label by full name to add or remove, with a confidence and whether it is ticked. One per message and label; posting one again replaces it. A suggestion that no longer fits the mailbox is skipped and counted: an unknown message or label, a label that is not the user's own, adding a label the message has or removing one it lacks.`,
    operationId: "CreateMailSuggestions",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "runId", description: "The building run", type: String })
  @ApiBody({
    type: CreateMailSuggestionsRequest,
    required: true,
    description: "Input for the CreateMailSuggestions operation",
  })
  @ApiCreatedResponse({
    description: "The batch was stored; some may have been skipped.",
    type: CreateMailSuggestionsResponse,
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
    description: "No such run.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The run is published.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("runId") runId: string,
    @Body() request: CreateMailSuggestionsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateMailSuggestionsResponse =
      await this.suggestions.createSuggestions(runId, request);
    response.status(HttpStatus.CREATED).send(body);
  }
}
