import { Controller, Get, Req, Res, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../auth/public";
import { fromPath, send } from "../ocspHttp";
import { OcspAnswerService } from "../services/OcspAnswerService";

/**
 * The OCSP responder (ADR 0036): `http://pki.internal.ncfritz.net/ocsp`,
 * proxied by the distribution host's nginx. Open to anyone, outside /v1
 * and its document; it answers from the responses signed ahead, so it
 * keeps answering while the signer is sealed. This is RFC 6960 A.1's GET: the request
 * base64 and URL-encoded in the path, which a cache can keep.
 */
@Public()
@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class GetOcspController {
  constructor(private readonly answers: OcspAnswerService) {}

  @Get("/ocsp/*request")
  async handle(@Req() request: Request, @Res() response: Response) {
    send(response, await this.answers.answer(fromPath(request.originalUrl)));
  }
}
