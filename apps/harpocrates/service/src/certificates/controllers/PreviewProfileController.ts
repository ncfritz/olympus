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
import {
  PreviewProfileRequest,
  PreviewProfileResponse,
} from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateService } from "../services/CertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class PreviewProfileController {
  constructor(private readonly certificates: CertificateService) {}

  @Post("/profiles/preview")
  @ApiOperation({
    summary: "Previews a profile version",
    description:
      "Returns the certificate a version's settings would produce, saved or not (ADR 0034): a sample request, as given or made up, taken through the version's rules and the signer's invariants as issuance takes one, and built by the signer with a throwaway key, so it reads as the real one and never verifies. Nothing is written. Why the version would not save, and why the request would be refused, come back with it.",
    operationId: "PreviewProfile",
    tags: ["Profiles"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: PreviewProfileRequest,
    required: true,
    description: "The version's settings, and the request to preview.",
  })
  @ApiOkResponse({
    description: "The certificate it would produce, or why not.",
    type: PreviewProfileResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(
    @Body() request: PreviewProfileRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: PreviewProfileResponse = {
      preview: await this.certificates.previewProfile(request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
