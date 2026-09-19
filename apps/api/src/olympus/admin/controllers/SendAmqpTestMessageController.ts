import { EmptyResponse, TestRequest } from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { TestMessageService } from "../services/TestMessageService";

@Controller({ version: "1" })
export class SendAmqpTestMessageController {
  constructor(private readonly testMessages: TestMessageService) {}

  @Post("/amqp/test/:exchange")
  @ApiOperation({
    summary: "Publishes a test message to RabbitMQ",
    description:
      "Publishes the request body as a message to the given RabbitMQ exchange, for testing.",
    operationId: "SendAmqpTestMessage",
    tags: ["Admin"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "Test message sent.",
    type: EmptyResponse,
  })
  @ApiParam({
    name: "exchange",
    required: true,
    description: "The exchange to publish the message to",
    type: String,
  })
  @ApiQuery({
    name: "routingKey",
    required: false,
    description: "The routing key to use when sending the test message",
    type: String,
  })
  @ApiBody({
    type: TestRequest,
    required: true,
    description: "The payload to send",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("exchange") exchange: string,
    @Query("routingKey") routingKey = "#",
    @Body() request: TestRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.testMessages.send(exchange, routingKey, request);

    response.status(HttpStatus.OK).send();
  }
}
