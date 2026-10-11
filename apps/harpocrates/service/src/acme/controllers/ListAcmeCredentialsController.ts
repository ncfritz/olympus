import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { ListAcmeCredentialsResponse } from "../../model/acme";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AcmeCredentialService } from "../services/AcmeCredentialService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListAcmeCredentialsController {
  constructor(private readonly credentials: AcmeCredentialService) {}

  @Get("/acme/credentials")
  @ApiOperation({
    summary: "Lists ACME credentials",
    description:
      "Every External Account Binding credential, newest first, with the names its account may request and the account it was bound to. Never their keys.",
    operationId: "ListAcmeCredentials",
    tags: ["ACME Credentials"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The credentials.",
    type: ListAcmeCredentialsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListAcmeCredentialsResponse = {
      credentials: await this.credentials.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
