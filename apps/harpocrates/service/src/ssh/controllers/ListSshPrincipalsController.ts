import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminOnly } from "../../auth/roles";
import { ListSshPrincipalsResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshPrincipalService } from "../services/SshPrincipalService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListSshPrincipalsController {
  constructor(private readonly principals: SshPrincipalService) {}

  @Get("/ssh/principals")
  @ApiOperation({
    summary: "Lists who may log in as whom",
    description:
      "Every Olympus identity mapped to SSH principals (ADR 0035): its user certificates carry those and no others.",
    operationId: "ListSshPrincipals",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The mappings.",
    type: ListSshPrincipalsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListSshPrincipalsResponse = {
      mappings: await this.principals.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
