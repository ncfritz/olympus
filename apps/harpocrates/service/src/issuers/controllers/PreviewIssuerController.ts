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
  PreviewIssuerRequest,
  PreviewIssuerResponse,
} from "../../model/issuers";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { IssuerPreviewService } from "../services/IssuerPreviewService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class PreviewIssuerController {
  constructor(private readonly previews: IssuerPreviewService) {}

  @Post("/issuers/preview")
  @ApiOperation({
    summary: "Previews a new CA",
    description:
      "Returns a root, intermediate or issuing CA as creating it would make it, with every setting beside its default and the reasons creating it would be refused (ADR 0032, Names and settings). Nothing is signed or recorded: the console shows it for review before the CA is created.",
    operationId: "PreviewIssuer",
    tags: ["Issuers"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: PreviewIssuerRequest,
    required: true,
    description:
      "The CA's tier, parent, parts and any settings instead of their defaults.",
  })
  @ApiOkResponse({
    description: "The CA as it would be created.",
    type: PreviewIssuerResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(
    @Body() request: PreviewIssuerRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: PreviewIssuerResponse =
      await this.previews.preview(request);
    response.status(HttpStatus.OK).send(responseBody);
  }
}
