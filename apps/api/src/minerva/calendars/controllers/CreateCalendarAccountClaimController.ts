import {
  CalendarAccountClaimReceiptResponse,
  CreateCalendarAccountClaimRequest,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConsumes,
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
import { CalendarAccountClaimService } from "../services/CalendarAccountClaimService";

@Controller({ version: "1" })
export class CreateCalendarAccountClaimController {
  constructor(private readonly claims: CalendarAccountClaimService) {}

  @Post("/calendar-account-claims")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Claims a calendar account by its email",
    description:
      "Claims the calendar accounts the sync agent holds without an owner that have this address, and mails each a link that confirms the claim (ADR 0028). The answer is the same whether or not any account has the address, so a claim does not reveal which accounts exist. Five claims per user a day.",
    operationId: "CreateCalendarAccountClaim",
    tags: ["Calendar Accounts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCalendarAccountClaimRequest,
    required: true,
    description: "Input for the CreateCalendarAccountClaim operation",
  })
  @ApiAcceptedResponse({
    type: CalendarAccountClaimReceiptResponse,
    description:
      "Accepted. If an unowned account has the address, the link is on its way there.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: "The caller has made five claims in the last day.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "No From address is configured for the claim email.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateCalendarAccountClaimRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CalendarAccountClaimReceiptResponse = {
      claimReceipt: await this.claims.create(
        user.userId,
        request?.claim?.email,
        request?.claim?.confirmPage,
      ),
    };
    response.status(HttpStatus.ACCEPTED).send(body);
  }
}
