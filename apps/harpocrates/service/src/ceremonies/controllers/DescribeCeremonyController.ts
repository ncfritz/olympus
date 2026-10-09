import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminOnly } from "../../auth/roles";
import { DescribeCeremonyResponse } from "../../model/ceremonies";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CeremonyService } from "../services/CeremonyService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeCeremonyController {
  constructor(private readonly ceremonies: CeremonyService) {}

  @Get("/ceremony/:ceremonyId")
  @ApiOperation({
    summary: "Describes a ceremony",
    description:
      "Who opened a ceremony, for which CA, and whether it is closed.",
    operationId: "DescribeCeremony",
    tags: ["Ceremonies"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "ceremonyId",
    description: "The ceremony's ID",
    type: String,
  })
  @ApiOkResponse({
    description: "The ceremony.",
    type: DescribeCeremonyResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(
    @Param("ceremonyId") ceremonyId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeCeremonyResponse = {
      ceremony: await this.ceremonies.describe(ceremonyId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
