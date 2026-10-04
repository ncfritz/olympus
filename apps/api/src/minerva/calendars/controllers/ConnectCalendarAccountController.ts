import {
  CalendarAccountSignInResponse,
  ConnectCalendarAccountRequest,
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
import { CalendarAccountService } from "../services/CalendarAccountService";

@Controller({ version: "1" })
export class ConnectCalendarAccountController {
  constructor(private readonly accounts: CalendarAccountService) {}

  @Post("/calendar-accounts/connect")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Starts connecting a calendar account",
    description:
      "Starts a sign-in at the provider that connects a new calendar account to the caller, and returns the provider's page to send the browser to. Signing in proves the account is the caller's (ADR 0028); the provider sends the browser to CompleteCalendarAccountConnect, and from there back to returnTo with the outcome.",
    operationId: "ConnectCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ConnectCalendarAccountRequest,
    required: true,
    description: "Input for the ConnectCalendarAccount operation",
  })
  @ApiOkResponse({
    type: CalendarAccountSignInResponse,
    description: "The sign-in was started.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "The calendar sync agent, or the API's public callback URL, is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: ConnectCalendarAccountRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CalendarAccountSignInResponse = {
      signIn: await this.accounts.connect(
        user.userId,
        request?.connection?.provider,
        request?.connection?.returnTo,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
