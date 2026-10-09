import { ListMailLabelsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailLabelService } from "../services/MailLabelService";

@Controller({ version: "1" })
export class ListMailLabelsController {
  constructor(private readonly labels: MailLabelService) {}

  @Get("/mail/labels")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the caller's mail labels with their kinds",
    description:
      "Every label of the caller's mail accounts, by name, with its kind (topical, state, system, retired), its family or merge target, and its message count (ADR 0030, Label kinds).",
    operationId: "ListMailLabels",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The labels.", type: ListMailLabelsResponse })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailLabelsResponse = {
      labels: await this.labels.list(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
