import { DescribeCollectionResponse } from "@ncfritz/olympus-model";
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
import { CollectionService } from "../services/CollectionService";

@Controller({ version: "1" })
export class DescribeCollectionController {
  constructor(private readonly collections: CollectionService) {}

  @Get("/metadata/collection/:collectionId")
  @ApiOperation({
    summary: "Describes a collection in Dionysus",
    description: "Retrieves the details of a collection in Dionysus.",
    operationId: "DescribeCollection",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "collectionId",
    description: "The ID of the collection to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeCollectionResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("collectionId", ParseIntPipe) collectionId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeCollectionResponse = {
      collection: await this.collections.describe(collectionId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
