import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { CreateContentJobRequest, EmptyResponse } from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class CreateContentJobController {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  @Post("/content/asset/:assetId/jobs")
  @ApiOperation({
    summary: "Creates a new content processing job",
    description:
      "Publishes a processing job of the requested type for a content asset.",
    operationId: "CreateContentJob",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to perform the job on",
    type: String,
    required: true,
  })
  @ApiBody({
    type: CreateContentJobRequest,
    required: true,
    description: "Input for the CreateContentJob operation",
  })
  @ApiOkResponse({
    description: "The job has been enqueued successfully.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Body() request: CreateContentJobRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.amqpConnection.publish(
      "content.trigger",
      `jobType.${request.type}`,
      {
        assetId: assetId,
      },
    );

    const responseBody: EmptyResponse = {};

    response.status(HttpStatus.OK).send(responseBody);
  }
}
