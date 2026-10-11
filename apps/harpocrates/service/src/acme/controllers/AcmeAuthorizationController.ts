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

/** RFC 8555 §7.5: an authorization (POST-as-GET), or its deactivation. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeAuthorizationController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly orders: AcmeOrderService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/authorization/:authorizationId")
  async handle(
    @Param("authorizationId", ParseUUIDPipe) authorizationId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.authorization(authorizationId),
      "kid",
    );
    response
      .status(200)
      .json(await this.orders.authorization(authorizationId, request));
  }
}
