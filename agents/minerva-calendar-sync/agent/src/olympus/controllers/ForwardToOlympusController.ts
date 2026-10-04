import {
  All,
  Body,
  Controller,
  Headers,
  Req,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { AuthUser } from "../../auth/authUser";
import { CurrentUser } from "../../auth/currentUser";
import { OlympusForwardingService } from "../services/OlympusForwardingService";

/** The answer headers worth passing on; the rest are the API's own. */
const PASSED_HEADERS = ["content-type", "retry-after"];

/**
 * The console's availability, from the Olympus API through the agent
 * (ADR 0029). Outside the OpenAPI document: these are the API's
 * operations, documented there, and the console calls them with the API's
 * own client.
 */
@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class ForwardToOlympusController {
  constructor(private readonly forwarding: OlympusForwardingService) {}

  @All("/olympus/v1/minerva/*path")
  async handle(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Headers("x-ncfritz-tz") timeZone: string | undefined,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const answer = await this.forwarding.forward(
      user,
      request.method,
      request.originalUrl,
      timeZone,
      body,
    );
    for (const name of PASSED_HEADERS) {
      const value = answer.headers[name];
      if (value !== undefined) response.setHeader(name, value);
    }
    response.status(answer.status);
    if (answer.body === undefined) {
      response.end();
    } else if (typeof answer.body === "string") {
      response.send(answer.body);
    } else {
      response.json(answer.body);
    }
  }
}
