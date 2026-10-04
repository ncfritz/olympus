import { DescribeCalendarAccountClaimResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
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
import { CalendarAccountClaimService } from "../services/CalendarAccountClaimService";

@Controller({ version: "1" })
export class DescribeCalendarAccountClaimController {
  constructor(private readonly claims: CalendarAccountClaimService) {}

  @Get("/calendar-account-claim/:token")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes a calendar account claim to its claimant",
    description:
      "The account a mailed claim link names, for the claimant to confirm with ConfirmCalendarAccountClaim. Changes nothing, since a mail scanner may open the link. Only the user who made the claim may see it.",
    operationId: "DescribeCalendarAccountClaim",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "token",
    description: "The token from the claim's link",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeCalendarAccountClaimResponse,
    description: "The claim.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Another user made the claim; the message says so.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The account has found an owner since the claim.",
  })
  @ApiResponse({
    status: HttpStatus.GONE,
    description: "The claim expired, was confirmed or was cancelled.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("token") token: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeCalendarAccountClaimResponse = {
      claim: await this.claims.describe(user.userId, token),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
