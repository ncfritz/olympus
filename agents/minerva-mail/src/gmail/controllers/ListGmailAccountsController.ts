import { Controller, Get, HttpStatus, Res, UseGuards } from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import { ListGmailAccountsResponse } from "../../model/gmail";
import { GmailCredentialStore } from "../GmailCredentialStore";

/** ListGmailAccounts: the mailboxes linked, without their tokens. */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class ListGmailAccountsController {
  constructor(private readonly credentials: GmailCredentialStore) {}

  @Get("/gmail-accounts")
  async handle(@Res() response: Response): Promise<void> {
    const body: ListGmailAccountsResponse = {
      accounts: this.credentials.list().map((c) => ({
        email: c.email,
        subject: c.subject,
        scope: c.scope,
        obtainedTime: c.obtainedAt,
      })),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
