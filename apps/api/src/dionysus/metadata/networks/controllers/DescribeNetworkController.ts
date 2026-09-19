import { DescribeNetworkResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { NetworkService } from "../services/NetworkService";

@Controller({ version: "1" })
export class DescribeNetworkController {
  constructor(private readonly networks: NetworkService) {}

  @Get("/metadata/network/:networkId")
  @ApiOperation({
    summary: "Describes a network in Dionysus",
    description: "Retrieves the details of a network in Dionysus.",
    operationId: "DescribeNetwork",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "networkId",
    description: "The ID of the network to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeNetworkResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("networkId", ParseIntPipe) networkId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeNetworkResponse = {
      network: await this.networks.describe(networkId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
