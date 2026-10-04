import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
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
export class RemoveCalendarAccountController {
  constructor(private readonly accounts: CalendarAccountService) {}

  @Delete("/calendar-account/:accountId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Removes one of the signed-in user's calendar accounts",
    description:
      "Stops syncing the account's calendars, deletes its credential at the sync agent and its meetings in Minerva. The caller's notes, their meeting links and their associations stay.",
    operationId: "RemoveCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiParam({
    name: "accountId",
    description: "The ID of the account",
    type: String,
  })
  @ApiNoContentResponse({ description: "The account was removed." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.accounts.remove(user.userId, accountId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
