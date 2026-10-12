import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import moment from "moment";
import { AnyPkiRole } from "../../auth/roles";
import { ListCertificateLineagesResponse } from "../../model/lineages";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { toLineage } from "../converters/LineageConverter";
import { LineageService } from "../services/LineageService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListCertificateLineagesController {
  constructor(private readonly lineages: LineageService) {}

  @Get("/certificate-lineages")
  @ApiOperation({
    summary: "Lists the certificates as lineages",
    description:
      "Each subject's certificates together, linked by renewal or issued again by the same CA for the same subject, newest first, with how the newest is renewed; those whose newest version is valid or ended within the last year, soonest to expire first.",
    operationId: "ListCertificateLineages",
    tags: ["Certificates"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The lineages.",
    type: ListCertificateLineagesResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const now = new Date();
    const responseBody: ListCertificateLineagesResponse = {
      asOf: moment(now),
      lineages: (await this.lineages.list(now)).map(toLineage),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
