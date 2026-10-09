import {
  Controller,
  Delete,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import { GmailCredentialStore } from "../GmailCredentialStore";

/** DeleteGmailAccount: forgets a mailbox's refresh token. */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class DeleteGmailAccountController {
  constructor(private readonly credentials: GmailCredentialStore) {}

  @Delete("/gmail-account/:email")
  async handle(
    @Param("email") email: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.credentials.remove(email)) {
      throw new NotFoundException(`No linked mailbox ${email}`);
    }
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
