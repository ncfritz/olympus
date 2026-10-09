import {
  ApplyMatchingMailProposalsRequest,
  ApplyMatchingMailProposalsResponse,
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
export class ApplyMatchingMailProposalsController {
  constructor(private readonly changes: MailChangeService) {}

  @Post("/mail/proposals/apply")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Applies every open proposal a filter matches to Gmail",
    description:
      "The review's bulk action (docs/plans/email-management phase 4): every proposal still to review over the caller's mail that the filter matches (a label, an action, a rule, a minimum confidence), the classifier's unticked ones left out, written to Gmail as batches, one per mailbox (more past 10,000 messages). Each message's proposals are one change; a label one proposal adds and another removes is left as it is. Follow the batches in the change log.",
    operationId: "ApplyMatchingMailProposals",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ApplyMatchingMailProposalsRequest,
    required: true,
    description: "Input for the ApplyMatchingMailProposals operation",
  })
  @ApiOkResponse({
    description: "The proposals matched and the batches started for them.",
    type: ApplyMatchingMailProposalsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "A mailbox is linked for reading only.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "Writes to Gmail are turned off, or the agent is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: ApplyMatchingMailProposalsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ApplyMatchingMailProposalsResponse =
      await this.changes.applyMatching(user.userId, request);
    response.status(HttpStatus.OK).send(body);
  }
}
