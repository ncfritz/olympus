import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import moment from "moment";
import { ListPrincipalsResponse } from "../../model/auth";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AnyPkiRole } from "../roles";
import { OlympusUserService } from "../services/OlympusUserService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListPrincipalsController {
  constructor(private readonly users: OlympusUserService) {}

  @Get("/principals")
  @ApiOperation({
    summary: "Lists who the recorded principals are",
    description:
      "The Olympus users Harpocrates has seen, each as the principal its records keep (user:<id>) and their email, so the console names people rather than IDs. A user is remembered when the console asks who is signed in.",
    operationId: "ListPrincipals",
    tags: ["Auth"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The users seen.",
    type: ListPrincipalsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListPrincipalsResponse = {
      principals: (await this.users.list()).map((user) => ({
        principal: `user:${user.id}`,
        email: user.email,
        createdAt: moment(user.createdAt),
        updatedAt: moment(user.updatedAt),
      })),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
