import { ListAvailableContentAssetTagsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetTagService } from "../services/ContentAssetTagService";

@Controller({ version: "1" })
export class ListAvailableContentAssetTagsController {
  constructor(private readonly contentAssetTags: ContentAssetTagService) {}

  @Get("/content/assetTags")
  @ApiOperation({
    summary: "Lists the available content asset tags",
    description:
      "Lists the available content asset tags.  This API accepts an optional content asset ID," +
      "tag type, and name. ",
    operationId: "ListAvailableContentAssetTags",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "assetId",
    description: "The ID of the content asset to the tags for",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "type",
    description: "Filter available tags by the type",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "name",
    description: "Filter based on the name.  This is a wildcard match",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: ListAvailableContentAssetTagsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("assetId") assetId: string | undefined,
    @Query("type") type: string | undefined,
    @Query("name") name: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListAvailableContentAssetTagsResponse = {
      tags: await this.contentAssetTags.listAvailable(assetId, type, name),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
