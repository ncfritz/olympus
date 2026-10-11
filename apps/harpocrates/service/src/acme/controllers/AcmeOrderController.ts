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

/** RFC 8555 §7.4: an order, as its account sees it (POST-as-GET). */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeOrderController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly orders: AcmeOrderService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/order/:orderId")
  async handle(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.order(orderId),
      "kid",
    );
    response.status(200).json(await this.orders.order(orderId, request));
  }
}
