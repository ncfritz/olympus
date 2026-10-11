import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";

/** RFC 8555 §7.2: a nonce, which every ACME answer's Replay-Nonce carries. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeNewNonceController {
  @Get("/acme/new-nonce")
  handle(@Res() response: Response): void {
    response.status(204).end();
  }
}
