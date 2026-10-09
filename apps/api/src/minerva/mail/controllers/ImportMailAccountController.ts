import {
  ImportMailAccountRequest,
  ImportMailAccountResponse,
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
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailAccountService } from "../services/MailAccountService";

@Controller({ version: "1" })
export class ImportMailAccountController {
  constructor(private readonly accounts: MailAccountService) {}

  @Post("/mail/accounts/import")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Makes a mailbox imported from Takeout a user's",
    description:
      "For the mail agent's Takeout import (ADR 0030, as amended): the mail account for the address, made the named user's with verification `import` if it is new. Importing the same mailbox for the same user again answers the same account. The archive's messages then arrive on the mail.messages queue under the account's ID.",
    operationId: "ImportMailAccount",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ImportMailAccountRequest,
    required: true,
    description: "Input for the ImportMailAccount operation",
  })
  @ApiOkResponse({
    type: ImportMailAccountResponse,
    description: "The account the archive is imported into.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The mailbox is already another user's.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: ImportMailAccountRequest,
    @Res() response: Response,
  ): Promise<void> {
    const mailAccount = await this.accounts.import(
      request?.email,
      request?.ownerEmail,
    );
    const body: ImportMailAccountResponse = { mailAccount };
    response.status(HttpStatus.OK).send(body);
  }
}
