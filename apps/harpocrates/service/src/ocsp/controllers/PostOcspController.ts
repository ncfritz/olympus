import { Controller, Post, Req, Res, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../auth/public";
import { send } from "../ocspHttp";
import { OcspAnswerService } from "../services/OcspAnswerService";

/**
 * The OCSP responder (ADR 0036): `http://pki.internal.ncfritz.net/ocsp`,
 * proxied by the distribution host's nginx. Open to anyone, outside /v1
 * and its document; it answers from the responses signed ahead, so it
 * keeps answering while the signer is sealed. This is its POST: the request as DER,
 * `application/ocsp-request`.
 */
@Public()
@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class PostOcspController {
  constructor(private readonly answers: OcspAnswerService) {}

  @Post("/ocsp")
  async handle(@Req() request: Request, @Res() response: Response) {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    send(response, await this.answers.answer(body));
  }
}
