import { Body, Controller, Post, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import { AcmeIssuanceService } from "../services/AcmeIssuanceService";
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeUrls } from "../services/AcmeUrls";

/**
 * RFC 8555 §7.6: revocation, by the account the certificate was issued to
 * or by the certificate's own key.
 */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeRevokeCertController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly issuance: AcmeIssuanceService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/revoke-cert")
  async handle(
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.revokeCert(),
      "either",
    );
    await this.issuance.revoke(request);
    response.status(200).end();
  }
}
