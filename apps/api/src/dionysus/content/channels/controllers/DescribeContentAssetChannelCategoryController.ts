import {
  DescribeContentAssetChannelCategoryResponse,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { ContentAuth, Curtain } from "../../auth/contentAuthDecorators";
import { ContentCurtain } from "../../auth/ContentCurtain";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetChannelCategoryService } from "../services/ContentAssetChannelCategoryService";

@Controller({ version: "1" })
export class DescribeContentAssetChannelCategoryController {
  constructor(
    private readonly contentAssetChannelCategories: ContentAssetChannelCategoryService,
  ) {}

  @Get("/content/channel/category/:categoryId")
  @ApiOperation({
    summary: "Describes an existing content asset channel category",
    description: "Describes an existing content asset channel category.",
    operationId: "DescribeContentAssetChannelCategory",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "categoryId",
    description: "The ID of the channel category to describe",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeContentAssetChannelCategoryResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth()
  async handle(
    @Param("categoryId") categoryId: string,
    @Curtain() curtain: ContentCurtain,
    @Res() response: Response,
  ): Promise<void> {
    const category: FullContentAssetChannelCategory =
      await this.contentAssetChannelCategories.describe(categoryId, curtain);

    const responseBody: DescribeContentAssetChannelCategoryResponse = {
      category: category,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
