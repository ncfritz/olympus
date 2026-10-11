import { Body, Controller, Post, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import { AcmeJwsService } from "../services/AcmeJwsService";
import { AcmeOrderService } from "../services/AcmeOrderService";
import { AcmeUrls } from "../services/AcmeUrls";

/** RFC 8555 §7.4: an order, for names the account's policy allows. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeNewOrderController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly orders: AcmeOrderService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/new-order")
  async handle(
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(body, this.urls.newOrder(), "kid");
    const answer = await this.orders.newOrder(request);
    response.location(answer.location).status(201).json(answer.body);
  }
}
