import {
  CreateCollectionRequest,
  CreateCollectionResponse,
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
import { DescribeCollectionController } from "./DescribeCollectionController";
import { setLocation } from "../../../../utils/location";
import { CollectionService } from "../services/CollectionService";

@Controller({ version: "1" })
export class CreateCollectionController {
  constructor(private readonly collections: CollectionService) {}

  @Put("/metadata/collections")
  @ApiOperation({
    summary: "Upserts a collection",
    description: "Creates or updates a collection.",
    operationId: "CreateCollection",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCollectionRequest,
    required: true,
    description: "Input for the CreateCollection operation",
  })
  @ApiCreatedResponse({
    type: CreateCollectionResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created collection",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCollectionRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const id = await this.collections.create(request.collection);

    const responseBody: CreateCollectionResponse = {
      id: id,
    };

    setLocation(response, httpRequest, DescribeCollectionController, {
      collectionId: id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
