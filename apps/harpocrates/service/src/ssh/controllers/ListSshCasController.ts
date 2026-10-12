import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { ListSshCasResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCaService } from "../services/SshCaService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListSshCasController {
  constructor(private readonly cas: SshCaService) {}

  @Get("/ssh/cas")
  @ApiOperation({
    summary: "Lists the SSH CAs",
    description:
      "Every SSH CA (ADR 0035), user CAs first, newest generation first, with the line that trusts each.",
    operationId: "ListSshCas",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The SSH CAs.", type: ListSshCasResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListSshCasResponse = { cas: await this.cas.list() };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
