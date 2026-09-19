import { PingResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import { amqpConfig, hasuraConfig } from "../../../config/configuration";
import type {
  AmqpConfigType,
  HasuraConfigType,
} from "../../../config/configuration";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class PingController {
  constructor(
    @Inject(hasuraConfig.KEY) private readonly hasura: HasuraConfigType,
    @Inject(amqpConfig.KEY) private readonly amqp: AmqpConfigType,
  ) {}

  @Get("/ping")
  @ApiOperation({
    summary: "Checks that the API is running",
    description:
      "Checks that the API is running and returns the hosts it is configured to use.",
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
        "hasura.host": this.hasura.host,
        "amqp.host": this.amqp.host,
      },
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
