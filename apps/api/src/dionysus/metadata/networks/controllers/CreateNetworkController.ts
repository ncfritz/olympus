import {
  CreateNetworkRequest,
  CreateNetworkResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeNetworkController } from "./DescribeNetworkController";
import { setLocation } from "../../../../utils/location";
import { NetworkService } from "../services/NetworkService";

@Controller({ version: "1" })
export class CreateNetworkController {
  constructor(private readonly networks: NetworkService) {}

  @Put("/metadata/networks")
  @ApiOperation({
    summary: "Upserts a network",
    description: "Creates or updates a network.",
    operationId: "CreateNetwork",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNetworkRequest,
    required: true,
    description: "Input for the CreateNetwork operation",
  })
  @ApiCreatedResponse({
    type: CreateNetworkResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created network",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNetworkRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const network = await this.networks.create(request.network);

    const responseBody: CreateNetworkResponse = {
      network: network,
    };

    setLocation(response, httpRequest, DescribeNetworkController, {
      networkId: network.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
