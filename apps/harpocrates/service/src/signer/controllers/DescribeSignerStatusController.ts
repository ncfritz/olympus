import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { DescribeSignerStatusResponse } from "../../model/signer";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SealService } from "../services/SealService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeSignerStatusController {
  constructor(private readonly seal: SealService) {}

  @Get("/signer/status")
  @ApiOperation({
    summary: "Describes the signer's seal",
    description:
      "Whether the signer is initialised and unsealed, why not, and its open ceremony.",
    operationId: "DescribeSignerStatus",
    tags: ["Signer"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The seal.",
    type: DescribeSignerStatusResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN, HttpStatus.SERVICE_UNAVAILABLE],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: DescribeSignerStatusResponse = {
      status: await this.seal.status(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
