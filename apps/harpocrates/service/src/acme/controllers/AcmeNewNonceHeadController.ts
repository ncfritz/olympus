import { Controller, Head, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";

/** RFC 8555 §7.2: HEAD new-nonce, which clients prefer: 200, no body. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeNewNonceHeadController {
  @Head("/acme/new-nonce")
  handle(@Res() response: Response): void {
    response.status(200).end();
  }
}
