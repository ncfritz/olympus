import {
  CalendarAccountSignInResponse,
  ReauthorizeCalendarAccountRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
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
import { CalendarAccountService } from "../services/CalendarAccountService";

@Controller({ version: "1" })
export class ReauthorizeCalendarAccountController {
  constructor(private readonly accounts: CalendarAccountService) {}

  @Post("/calendar-account/:accountId/reauthorize")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Starts signing one of the user's calendar accounts in again",
    description:
      "Starts a sign-in at the provider for one of the caller's calendar accounts, whose credential expired, and returns the provider's page to send the browser to. Signing in as any other account is refused and changes nothing.",
    operationId: "ReauthorizeCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The ID of the account",
    type: String,
  })
  @ApiBody({
    type: ReauthorizeCalendarAccountRequest,
    required: true,
    description: "Input for the ReauthorizeCalendarAccount operation",
  })
  @ApiOkResponse({
    type: CalendarAccountSignInResponse,
    description: "The sign-in was started.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() request: ReauthorizeCalendarAccountRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CalendarAccountSignInResponse = {
      signIn: await this.accounts.reauthorize(
        user.userId,
        accountId,
        request?.reauthorization?.returnTo,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
