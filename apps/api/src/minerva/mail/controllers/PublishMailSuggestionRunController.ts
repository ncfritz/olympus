import {
  PublishMailSuggestionRunRequest,
  PublishMailSuggestionRunResponse,
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
import { MailSuggestionService } from "../services/MailSuggestionService";

@Controller({ version: "1" })
export class PublishMailSuggestionRunController {
  constructor(private readonly suggestions: MailSuggestionService) {}

  @Post("/mail/suggestion-run/:runId/publish")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Publishes a run of the classifier's suggestions",
    description:
      "For the mail classifier (docs/plans/email-management phase 4): the run's suggestions become the account's, beside the audit's on the Re-classification page, and the account's runs before it are dropped, in one transaction.",
    operationId: "PublishMailSuggestionRun",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "runId", description: "The building run", type: String })
  @ApiBody({
    type: PublishMailSuggestionRunRequest,
    required: true,
    description: "Input for the PublishMailSuggestionRun operation",
  })
  @ApiOkResponse({
    description: "The run, published.",
    type: PublishMailSuggestionRunResponse,
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
    description: "The run is published already.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("runId") runId: string,
    @Body() request: PublishMailSuggestionRunRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: PublishMailSuggestionRunResponse = {
      run: await this.suggestions.publish(runId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
