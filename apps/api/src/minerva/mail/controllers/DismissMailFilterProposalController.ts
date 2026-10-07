import {
  DismissMailFilterProposalRequest,
  DismissMailFilterProposalResponse,
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
import { MailFilterService } from "../services/MailFilterService";

@Controller({ version: "1" })
export class DismissMailFilterProposalController {
  constructor(private readonly filters: MailFilterService) {}

  @Post("/mail/account/:accountId/filter-proposals/dismiss")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Declines a filter proposal",
    description:
      "The sender and label are not proposed a filter again (docs/plans/email-management phase 7). Gmail is not changed.",
    operationId: "DismissMailFilterProposal",
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
    type: DismissMailFilterProposalRequest,
    required: true,
    description: "Input for the DismissMailFilterProposal operation",
  })
  @ApiOkResponse({
    description: "The proposal was declined.",
    type: DismissMailFilterProposalResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account of the caller's, or no such user label.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: DismissMailFilterProposalRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.filters.dismiss(user.userId, accountId, request);
    const body: DismissMailFilterProposalResponse = { dismissed: true };
    response.status(HttpStatus.OK).send(body);
  }
}
