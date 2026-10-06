import {
  CreateMailLabelFamilyRequest,
  CreateMailLabelFamilyResponse,
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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailLabelService } from "../services/MailLabelService";

@Controller({ version: "1" })
export class CreateMailLabelFamilyController {
  constructor(private readonly labels: MailLabelService) {}

  @Post("/mail/families")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Creates a family of state labels",
    description:
      "Makes two or more of the caller's topical labels, of one account, the states of a family (`Bills`: `*Payable`, then `*Paid`): each open or closed, one open state the initial, with the moves allowed between them. The classifier then predicts the family and applies the initial state.",
    operationId: "CreateMailLabelFamily",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMailLabelFamilyRequest,
    required: true,
    description: "Input for the CreateMailLabelFamily operation",
  })
  @ApiCreatedResponse({
    description: "The family was created.",
    type: CreateMailLabelFamilyResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "A label is not topical, or the account has a family of that name.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateMailLabelFamilyRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateMailLabelFamilyResponse = {
      family: await this.labels.createFamily(user.userId, request),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}
