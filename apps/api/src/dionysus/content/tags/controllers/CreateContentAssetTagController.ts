import {
  ContentAssetTag,
  CreateContentAssetTagRequest,
  CreateContentAssetTagResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetTagService } from "../services/ContentAssetTagService";

@Controller({ version: "1" })
export class CreateContentAssetTagController {
  constructor(private readonly contentAssetTags: ContentAssetTagService) {}

  @Post("/content/assetTags")
  @ApiOperation({
    summary: "Creates a new content asset tag",
    description:
      "Creates a new content asset tag that can then be added to content assets.",
    operationId: "CreateContentAssetTag",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetTagRequest,
    required: true,
    description: "Input for the CreateContentAssetTag operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetTagResponse,
  })
  @ApiConflictResponse({
    description: "A tag with the same name and type already exists",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetTagRequest,
    @Res() response: Response,
  ): Promise<void> {
    const createdContentAssetTag: ContentAssetTag =
      await this.contentAssetTags.create(request.tag);

    const responseBody: CreateContentAssetTagResponse = {
      tag: createdContentAssetTag,
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
