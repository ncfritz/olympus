import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import {
  StartGmailWritesRequest,
  StartGmailWritesResponse,
} from "../../model/gmail";
import { GmailWriter } from "../GmailWriter";

/**
 * StartGmailWrites: a batch of label changes the API recorded, taken to be
 * written to Gmail in the background (202). Off unless MAIL_WRITES_ENABLED.
 */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class StartGmailWritesController {
  constructor(private readonly writer: GmailWriter) {}

  @Post("/gmail-writes")
  async handle(
    @Body() request: StartGmailWritesRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.writer.enabled) {
      throw new ServiceUnavailableException(
        "Writes to Gmail are turned off at the mail agent (MAIL_WRITES_ENABLED)",
      );
    }
    const body: StartGmailWritesResponse = {
      accepted: this.writer.accept(request),
    };
    response.status(HttpStatus.ACCEPTED).send(body);
  }
}
