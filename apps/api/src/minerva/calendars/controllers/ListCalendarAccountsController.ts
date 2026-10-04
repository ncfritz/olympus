import { ListCalendarAccountsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
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
export class ListCalendarAccountsController {
  constructor(private readonly accounts: CalendarAccountService) {}

  @Get("/calendar-accounts")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's calendar accounts",
    description:
      "Returns the caller's calendar accounts with the state of each one's credential at the sync agent. An account the agent holds that is the caller's sign-in identity is linked to them first (ADR 0028). Without the agent, the state is unknown.",
    operationId: "ListCalendarAccounts",
    tags: ["Calendar Accounts"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListCalendarAccountsResponse,
    description: "The caller's accounts.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListCalendarAccountsResponse = {
      calendarAccounts: await this.accounts.list(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
