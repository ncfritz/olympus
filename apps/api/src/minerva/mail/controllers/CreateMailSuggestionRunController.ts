import {
  CreateMailSuggestionRunRequest,
  CreateMailSuggestionRunResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailSuggestionService } from "../services/MailSuggestionService";

@Controller({ version: "1" })
export class CreateMailSuggestionRunController {
  constructor(private readonly suggestions: MailSuggestionService) {}

  @Post("/mail/suggestion-runs")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Begins a run of the classifier's suggestions",
    description:
      "For the mail classifier (docs/plans/email-management phase 4): a run for one account, building until it is published. Its suggestions are posted with CreateMailSuggestions and show nowhere until PublishMailSuggestionRun.",
    operationId: "CreateMailSuggestionRun",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMailSuggestionRunRequest,
    required: true,
    description: "Input for the CreateMailSuggestionRun operation",
  })
  @ApiCreatedResponse({
    description: "The run was begun.",
    type: CreateMailSuggestionRunResponse,
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
    @Body() request: CreateMailSuggestionRunRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateMailSuggestionRunResponse = {
      run: await this.suggestions.createRun(request),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
