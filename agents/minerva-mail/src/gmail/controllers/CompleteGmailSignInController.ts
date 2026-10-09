import {
  BadGatewayException,
  Body,
  ConflictException,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import {
  CompleteGmailSignInRequest,
  CompleteGmailSignInResponse,
} from "../../model/gmail";
import { GmailAccountMismatchError } from "../GmailAccountMismatchError";
import { GmailAuth } from "../GmailAuth";
import { requireSignIn } from "../signInRequests";

/**
 * CompleteGmailSignIn: exchanges the callback the API received and keeps
 * the mailbox's refresh token. 409 when the sign-in was for another
 * account (nothing kept); 502 when Google refused the exchange.
 */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class CompleteGmailSignInController {
  private readonly logger = new Logger(CompleteGmailSignInController.name);

  constructor(private readonly auth: GmailAuth) {}

  @Post("/gmail-sign-ins/complete")
  async handle(
    @Body() request: CompleteGmailSignInRequest,
    @Res() response: Response,
  ): Promise<void> {
    requireSignIn(request, [
      "callbackUrl",
      "redirectUri",
      "state",
      "codeVerifier",
      "email",
    ]);
    try {
      const body: CompleteGmailSignInResponse = {
        account: await this.auth.complete(request),
      };
      response.status(HttpStatus.OK).send(body);
    } catch (error) {
      if (error instanceof GmailAccountMismatchError) {
        throw new ConflictException({
          message: error.message,
          reason: error.reason,
        });
      }
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Gmail sign-in failed: ${message}`);
      throw new BadGatewayException(message);
    }
  }
}
