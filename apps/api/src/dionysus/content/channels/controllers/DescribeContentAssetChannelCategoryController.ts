import {
  DescribeContentAssetChannelCategoryResponse,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Req, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetChannelCategoryService } from "../services/ContentAssetChannelCategoryService";
import { contentAuthToken } from "../../auth/contentAuth";

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
  async handle(
    @Param("categoryId") categoryId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const category: FullContentAssetChannelCategory =
      await this.contentAssetChannelCategories.describe(
        categoryId,
        contentAuthToken(request),
      );

    const responseBody: DescribeContentAssetChannelCategoryResponse = {
      category: category,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
