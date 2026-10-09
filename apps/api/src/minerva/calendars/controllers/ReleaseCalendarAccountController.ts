import {
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { CalendarAccountClaimService } from "../services/CalendarAccountClaimService";

@Controller({ version: "1" })
export class ReleaseCalendarAccountController {
  constructor(private readonly claims: CalendarAccountClaimService) {}

  @Post("/calendar-account/:accountId/release")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Makes a calendar account unowned again",
    description:
      "For an account linked to the wrong user (ADR 0028). Its owner's meetings from it are deleted, keeping their notes, meeting links and associations, and its open claims are cancelled. The sync agent keeps the credential, so the account can be claimed again; until then its events are not stored.",
    operationId: "ReleaseCalendarAccount",
    tags: ["Calendar Accounts"],
  })
  @ApiParam({
    name: "accountId",
    description: "The ID of the account",
    type: String,
  })
  @ApiNoContentResponse({ description: "The account is unowned." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an admin.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.claims.release(accountId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
