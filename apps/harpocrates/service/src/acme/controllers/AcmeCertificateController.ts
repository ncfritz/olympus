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
import { AcmeIssuanceService } from "../services/AcmeIssuanceService";
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeUrls } from "../services/AcmeUrls";

/**
 * RFC 8555 §7.4.2: an issued certificate and the CAs above it, not the
 * root (POST-as-GET), for the account it was issued to.
 */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeCertificateController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly issuance: AcmeIssuanceService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/certificate/:certificateId")
  async handle(
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.certificate(certificateId),
      "kid",
    );
    const chain = await this.issuance.certificateChain(certificateId, request);
    response.status(200).type("application/pem-certificate-chain").send(chain);
  }
}
