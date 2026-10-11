import { Body, Controller, Post, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import { AcmeAccountService } from "../services/AcmeAccountService";
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeUrls } from "../services/AcmeUrls";

/** RFC 8555 §7.3.5: an account's key, replaced. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeKeyChangeController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly accounts: AcmeAccountService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/key-change")
  async handle(
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(body, this.urls.keyChange(), "kid");
    response.status(200).json(await this.accounts.keyChange(request));
  }
}
