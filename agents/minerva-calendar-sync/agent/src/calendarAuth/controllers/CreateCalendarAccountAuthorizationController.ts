import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CreateCalendarAccountAuthorizationRequest,
  CreateCalendarAccountAuthorizationResponse,
} from "../../model/calendarAccounts";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CalendarAccountService } from "../services/CalendarAccountService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateCalendarAccountAuthorizationController {
  constructor(private readonly calendarAccounts: CalendarAccountService) {}

  @Post("/calendar-account-authorizations")
  @ApiOperation({
    summary: "Creates a calendar account authorization",
    description:
      "Starts a sign-in that connects a new account of the provider; poll DescribeCalendarAccountAuthorization for its outcome.",
    operationId: "CreateCalendarAccountAuthorization",
    tags: ["Calendar Accounts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCalendarAccountAuthorizationRequest,
    required: true,
    description: "The authorization to start.",
  })
  @ApiCreatedResponse({
    description: "The authorization was started.",
    type: CreateCalendarAccountAuthorizationResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description:
          "The DescribeCalendarAccountAuthorization route of the authorization",
      },
    },
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Body() request: CreateCalendarAccountAuthorizationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const calendarAccountAuthorization =
      await this.calendarAccounts.createAuthorization(
        request.calendarAccountAuthorization.provider,
      );
    const responseBody: CreateCalendarAccountAuthorizationResponse = {
      calendarAccountAuthorization,
    };
    response.location(
      `/v1/calendar-account-authorization/${encodeURIComponent(calendarAccountAuthorization.authorizationId)}`,
    );
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
