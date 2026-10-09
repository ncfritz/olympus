import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { ServicesOnly } from "../../auth/servicesOnly";
import {
  CompleteCalendarAccountWebSignInRequest,
  CompleteCalendarAccountWebSignInResponse,
} from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@Controller({ version: "1" })
export class CompleteCalendarAccountWebSignInController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Post("/calendar-account-web-sign-ins/complete")
  @ServicesOnly()
  @ApiOperation({
    summary: "Completes a calendar account web sign-in",
    description:
      "Redeems the provider's redirect of a web sign-in and stores the account's credential, returning who signed in. Signing a stored account in again as a different account is a conflict, and changes nothing (ADR 0028). Only the Olympus API, by its client certificate, may call it.",
    operationId: "CompleteCalendarAccountWebSignIn",
    tags: ["Calendar Accounts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CompleteCalendarAccountWebSignInRequest,
    required: true,
    description: "The provider's redirect.",
  })
  @ApiOkResponse({
    description: "The account signed in, and its credential is stored.",
    type: CompleteCalendarAccountWebSignInResponse,
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.CONFLICT] })
  async handle(
    @Body() body: CompleteCalendarAccountWebSignInRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CompleteCalendarAccountWebSignInResponse = {
      calendarAccount: await this.calendarAccounts.completeWebSignIn(
        body.callback,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
