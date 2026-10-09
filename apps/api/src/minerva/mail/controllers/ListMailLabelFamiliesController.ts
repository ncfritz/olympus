import { ListMailLabelFamiliesResponse } from "@ncfritz/olympus-model";
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
export class ListMailLabelFamiliesController {
  constructor(private readonly labels: MailLabelService) {}

  @Get("/mail/families")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the caller's label families",
    description:
      "The caller's families of state labels, by name, each with its states (open or closed), its initial state and the moves it allows (ADR 0030, Label kinds).",
    operationId: "ListMailLabelFamilies",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The families.",
    type: ListMailLabelFamiliesResponse,
  })
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
    const body: ListMailLabelFamiliesResponse = {
      families: await this.labels.listFamilies(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
