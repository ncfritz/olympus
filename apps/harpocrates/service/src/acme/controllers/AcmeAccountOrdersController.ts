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
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeOrderService } from "../services/AcmeOrderService";
import { AcmeUrls } from "../services/AcmeUrls";

/** RFC 8555 §7.1.2.1: an account's orders (POST-as-GET). */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeAccountOrdersController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly orders: AcmeOrderService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/account/:accountId/orders")
  async handle(
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.orders(accountId),
      "kid",
    );
    response
      .status(200)
      .json({ orders: await this.orders.orders(accountId, request) });
  }
}
