import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import type { GmailMessageContent } from "../../model/gmail";
import { GmailMessageReader } from "../GmailMessageReader";

/**
 * GetGmailMessage: one message read live from Gmail for the API to show,
 * never stored or logged, and not to be cached.
 */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class GetGmailMessageController {
  constructor(private readonly reader: GmailMessageReader) {}

  @Get("/gmail-messages/:gmailId")
  async handle(
    @Param("gmailId") gmailId: string,
    @Query("email") email: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!email || !email.includes("@")) {
      throw new BadRequestException("email must be the mailbox's address");
    }
    const body: GmailMessageContent = await this.reader.read(email, gmailId);
    response.status(HttpStatus.OK).set("Cache-Control", "no-store").send(body);
  }
}
