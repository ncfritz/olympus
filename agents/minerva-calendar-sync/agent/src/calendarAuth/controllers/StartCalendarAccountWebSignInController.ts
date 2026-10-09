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
  StartCalendarAccountWebSignInRequest,
  StartCalendarAccountWebSignInResponse,
} from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@Controller({ version: "1" })
export class StartCalendarAccountWebSignInController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Post("/calendar-account-web-sign-ins")
  @ServicesOnly()
  @ApiOperation({
    summary: "Starts a calendar account web sign-in",
    description:
      "Returns the provider's sign-in URL for a sign-in the Olympus API started for one of its users, with the API's callback, state and PKCE challenge (ADR 0028). With accountLabel, signs a stored account in again. Only the Olympus API, by its client certificate, may call it.",
    operationId: "StartCalendarAccountWebSignIn",
    tags: ["Calendar Accounts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: StartCalendarAccountWebSignInRequest,
    required: true,
    description: "The sign-in to start.",
  })
  @ApiOkResponse({
    description: "The provider's sign-in URL.",
    type: StartCalendarAccountWebSignInResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() body: StartCalendarAccountWebSignInRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: StartCalendarAccountWebSignInResponse = {
      authUrl: await this.calendarAccounts.startWebSignIn(body.webSignIn),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
