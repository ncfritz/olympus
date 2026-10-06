import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import {
  StartGmailSignInRequest,
  StartGmailSignInResponse,
} from "../../model/gmail";
import { GmailAuth } from "../GmailAuth";
import { requireSignIn } from "../signInRequests";

/** StartGmailSignIn: Google's consent URL for a mailbox the API is linking. */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class StartGmailSignInController {
  constructor(private readonly auth: GmailAuth) {}

  @Post("/gmail-sign-ins")
  async handle(
    @Body() request: StartGmailSignInRequest,
    @Res() response: Response,
  ): Promise<void> {
    requireSignIn(request, ["redirectUri", "state", "codeChallenge", "email"]);
    const body: StartGmailSignInResponse = {
      authUrl: this.auth.start(request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
