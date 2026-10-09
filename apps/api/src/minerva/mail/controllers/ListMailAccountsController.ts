import { ListMailAccountsResponse } from "@ncfritz/olympus-model";
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
import { MailLinkService } from "../services/MailLinkService";

@Controller({ version: "1" })
export class ListMailAccountsController {
  constructor(private readonly links: MailLinkService) {}

  @Get("/mail/accounts")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the caller's mail accounts",
    description:
      "Each of the caller's mailboxes, by address: how it became theirs, and whether and when it was linked to Gmail (docs/plans/email-management phase 1b).",
    operationId: "ListMailAccounts",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The accounts.",
    type: ListMailAccountsResponse,
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
    const body: ListMailAccountsResponse = {
      accounts: await this.links.list(user.userId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
