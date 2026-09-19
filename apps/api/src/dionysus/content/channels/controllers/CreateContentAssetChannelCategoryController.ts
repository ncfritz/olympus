import {
  CreateContentAssetChannelCategoryRequest,
  CreateContentAssetChannelCategoryResponse,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeContentAssetChannelCategoryController } from "./DescribeContentAssetChannelCategoryController";
import { setLocation } from "../../../../utils/location";
import { ContentAssetChannelCategoryService } from "../services/ContentAssetChannelCategoryService";

@Controller({ version: "1" })
export class CreateContentAssetChannelCategoryController {
  constructor(
    private readonly contentAssetChannelCategories: ContentAssetChannelCategoryService,
  ) {}

  @Post("/content/channels/categories")
  @ApiOperation({
    summary: "Creates a new content asset channel category",
    description: "Creates a new content asset channel category.",
    operationId: "CreateContentAssetChannelCategory",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetChannelCategoryRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetChannelCategoryResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetChannelCategoryRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdCategory: FullContentAssetChannelCategory =
      await this.contentAssetChannelCategories.create(request.category);

    const responseBody: CreateContentAssetChannelCategoryResponse = {
      category: createdCategory,
    };

    setLocation(
      response,
      httpRequest,
      DescribeContentAssetChannelCategoryController,
      { categoryId: createdCategory.id },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
