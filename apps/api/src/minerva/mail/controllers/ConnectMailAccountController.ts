import {
  ConnectMailAccountRequest,
  ConnectMailAccountResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
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
import { MailLinkService } from "../services/MailLinkService";

@Controller({ version: "1" })
export class ConnectMailAccountController {
  constructor(private readonly links: MailLinkService) {}

  @Post("/mail/account/:accountId/connect")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Starts linking a mail account to Gmail",
    description:
      "Starts a Google sign-in that links one of the caller's mailboxes to Gmail (docs/plans/email-management phase 1b; ADR 0030 by ADR 0028's consent flow), and returns Google's page to send the browser to. The sign-in must be the mailbox's own account: its address, and once linked, the same Google account. Google sends the browser to CompleteMailAccountConnect, and from there back to returnTo with the outcome.",
    operationId: "ConnectMailAccount",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account to link",
    type: String,
  })
  @ApiBody({
    type: ConnectMailAccountRequest,
    required: true,
    description: "Input for the ConnectMailAccount operation",
  })
  @ApiOkResponse({
    description: "Google's sign-in page.",
    type: ConnectMailAccountResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "The account is not the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "The mail agent or the API's public address is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: ConnectMailAccountRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ConnectMailAccountResponse = {
      authUrl: await this.links.connect(
        user.userId,
        accountId,
        request?.returnTo,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
