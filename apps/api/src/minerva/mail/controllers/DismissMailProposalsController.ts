import {
  DismissMailProposalsRequest,
  DismissMailProposalsResponse,
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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailChangeService } from "../services/MailChangeService";

@Controller({ version: "1" })
export class DismissMailProposalsController {
  constructor(private readonly changes: MailChangeService) {}

  @Post("/mail/account/:accountId/proposals/dismiss")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Marks proposed label changes processed without change",
    description:
      "Records a decision not to make proposed changes (docs/plans/email-management phase 4): they show as processed, whichever audit or classifier run proposes them again. Gmail is not changed. A proposal decided already keeps its decision; one naming a message or label the account no longer has is passed over.",
    operationId: "DismissMailProposals",
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
    type: DismissMailProposalsRequest,
    required: true,
    description: "Input for the DismissMailProposals operation",
  })
  @ApiOkResponse({
    description: "How many were marked processed.",
    type: DismissMailProposalsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "The account is not the caller's.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: DismissMailProposalsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DismissMailProposalsResponse = {
      dismissed: await this.changes.dismiss(user.userId, accountId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
