import { Controller, Get, Param, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import {
  AcmeRenewalInfoService,
  RENEWAL_INFO_RETRY_SECONDS,
} from "../services/AcmeRenewalInfoService";

/** RFC 9773: when a certificate should be renewed (a plain GET). */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeRenewalInfoController {
  constructor(private readonly renewalInfo: AcmeRenewalInfoService) {}

  @Get("/acme/renewal-info/:certId")
  async handle(
    @Param("certId") certId: string,
    @Res() response: Response,
  ): Promise<void> {
    const info = await this.renewalInfo.renewalInfo(certId);
    response
      .setHeader("Retry-After", String(RENEWAL_INFO_RETRY_SECONDS))
      .status(200)
      .json(info);
  }
}
