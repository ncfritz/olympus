import {
  DismissMailProposalsResponse,
  DismissMatchingMailProposalsRequest,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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
import { MailChangeService } from "../services/MailChangeService";

@Controller({ version: "1" })
export class DismissMatchingMailProposalsController {
  constructor(private readonly changes: MailChangeService) {}

  @Post("/mail/proposals/dismiss")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Marks every open proposal a filter matches processed",
    description:
      "The review's bulk action without a change (docs/plans/email-management phase 4): every proposal still to review over the caller's mail that the filter matches, unticked ones too, recorded as processed. Gmail is not changed.",
    operationId: "DismissMatchingMailProposals",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: DismissMatchingMailProposalsRequest,
    required: true,
    description: "Input for the DismissMatchingMailProposals operation",
  })
  @ApiOkResponse({
    description: "How many were marked processed.",
    type: DismissMailProposalsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: DismissMatchingMailProposalsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DismissMailProposalsResponse = {
      dismissed: await this.changes.dismissMatching(user.userId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
