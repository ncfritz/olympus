import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminOnly } from "../../auth/roles";
import { ImportedKey } from "../../model/certificates";
import { ReadKeyResponse } from "../../model/signer";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SignerService } from "../services/SignerService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ReadKeyController {
  constructor(private readonly signer: SignerService) {}

  @Post("/keys/read")
  @ApiOperation({
    summary: "Reads a key without keeping it",
    description:
      "Decrypts a key about to be imported (encrypted PKCS#8, or the key in a PKCS#12 file) and says its type and public key, keeping nothing (ADR 0039): so an import can check the key is its CSR's and certificate's before the signer takes it, since a key once taken is refused for good after.",
    operationId: "ReadKey",
    tags: ["Signer"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: ImportedKey,
    required: true,
    description: "The key and its passphrase.",
  })
  @ApiOkResponse({
    description: "Its type and public key.",
    type: ReadKeyResponse,
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.SERVICE_UNAVAILABLE],
  })
  @AdminOnly()
  async handle(
    @Body() request: ImportedKey,
    @Res() response: Response,
  ): Promise<void> {
    const read = await this.signer.readKey(
      request.data,
      request.passphrase,
      request.format,
    );
    const responseBody: ReadKeyResponse = {
      algorithm: read.algorithm,
      publicKey: read.publicKey,
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
