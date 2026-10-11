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

/** RFC 8555 §7.4: a ready order, finalized with a CSR for its names. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeFinalizeController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly issuance: AcmeIssuanceService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/order/:orderId/finalize")
  async handle(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.finalize(orderId),
      "kid",
    );
    const order = await this.issuance.finalize(orderId, request);
    response.location(this.urls.order(orderId)).status(200).json(order);
  }
}
