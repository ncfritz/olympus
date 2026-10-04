import { DescribeCalendarAccountResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
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
export class ConfirmCalendarAccountClaimController {
  constructor(private readonly claims: CalendarAccountClaimService) {}

  @Post("/calendar-account-claim/:token/confirm")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Confirms a calendar account claim",
    description:
      "Links the claimed account to the caller, who made the claim, as proven by its mailed link (claim_email, ADR 0028), and asks the sync agent to publish the account's events again so its earlier meetings reach Minerva. The link works once.",
    operationId: "ConfirmCalendarAccountClaim",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "token",
    description: "The token from the claim's link",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeCalendarAccountResponse,
    description: "The account, now the caller's.",
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
    description:
      "The account has found an owner since the claim, or another user signs in to Olympus with it.",
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
    const body: DescribeCalendarAccountResponse = {
      calendarAccount: await this.claims.confirm(user.userId, token),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
