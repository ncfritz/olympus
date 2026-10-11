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

/**
 * RFC 8555 §7.5.1: a challenge (POST-as-GET), or the client saying it
 * is ready to be validated (a POST of {}).
 */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeChallengeController {
  constructor(
    private readonly jws: AcmeJwsService,
    private readonly orders: AcmeOrderService,
    private readonly urls: AcmeUrls,
  ) {}

  @Post("/acme/challenge/:challengeId")
  async handle(
    @Param("challengeId", ParseUUIDPipe) challengeId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const request = await this.jws.verify(
      body,
      this.urls.challenge(challengeId),
      "kid",
    );
    const answer = await this.orders.challenge(challengeId, request);
    response.append("Link", `<${answer.up}>;rel="up"`);
    response.status(200).json(answer.body);
  }
}
