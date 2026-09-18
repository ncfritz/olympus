import { PingResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../utils/controllerDecorators";

@Controller({ version: "1" })
export class PingController {
  constructor(private configService: ConfigService) {}

  @Get("/ping")
  @ApiOperation({
    summary: "Ping",
    description: "Ping",
    operationId: "Ping",
    tags: ["Admin"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The calendar items have been successfully fetched.",
    type: PingResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: PingResponse = {
      config: {
        "hasura.host": this.configService.get<string>("HASURA_HOST")!,
        "amqp.host": this.configService.get<string>("AMQP_HOST")!,
      },
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
