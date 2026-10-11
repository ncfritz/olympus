import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import { AcmeAccountService } from "../services/AcmeAccountService";
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeUrls } from "../services/AcmeUrls";

/** RFC 8555 §7.3.2–7.3.6: an account describes, updates or deactivates itself. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeAccountController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly accounts: AcmeAccountService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/account/:accountId")
  async handle(
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.account(accountId),
      "kid",
    );
    response.status(200).json(await this.accounts.account(accountId, request));
  }
}
