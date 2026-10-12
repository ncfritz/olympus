import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { DescribeSshCaResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCaService } from "../services/SshCaService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeSshCaController {
  constructor(private readonly cas: SshCaService) {}

  @Get("/ssh/ca/:caId")
  @ApiOperation({
    summary: "Describes an SSH CA",
    description:
      "Its type, generation, status, public key and the line that trusts it.",
    operationId: "DescribeSshCa",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "caId", description: "The CA's slug", type: String })
  @ApiOkResponse({ description: "The CA.", type: DescribeSshCaResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("caId") caId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeSshCaResponse = {
      ca: await this.cas.describe(caId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
