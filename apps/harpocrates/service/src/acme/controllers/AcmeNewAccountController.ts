import { Body, Controller, Post, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import { AcmeAccountService } from "../services/AcmeAccountService";
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeUrls } from "../services/AcmeUrls";

/**
 * RFC 8555 §7.3: registers an account with an External Account Binding,
 * or answers with the account its key already has.
 */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeNewAccountController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly accounts: AcmeAccountService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/new-account")
  async handle(
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(body, this.urls.newAccount(), "jwk");
    const answer = await this.accounts.newAccount(request);
    response.location(answer.location).status(answer.status).json(answer.body);
  }
}
