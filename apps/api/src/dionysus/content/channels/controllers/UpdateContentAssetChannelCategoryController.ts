import {
  FullContentAssetChannelCategory,
  UpdateContentAssetChannelCategoryRequest,
  UpdateContentAssetChannelCategoryResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
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
import { ContentAssetChannelCategoryService } from "../services/ContentAssetChannelCategoryService";

@Controller({ version: "1" })
export class UpdateContentAssetChannelCategoryController {
  constructor(
    private readonly contentAssetChannelCategories: ContentAssetChannelCategoryService,
  ) {}

  @Put("/content/channels/category/:categoryId")
  @ApiOperation({
    summary: "Updates an existing content asset channel category",
    description: "Updates an existing content asset channel category.",
    operationId: "UpdateContentAssetChannelCategory",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: UpdateContentAssetChannelCategoryRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiParam({
    name: "categoryId",
    description: "The ID of the category to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateContentAssetChannelCategoryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("categoryId") categoryId: string,
    @Body() request: UpdateContentAssetChannelCategoryRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updatedCategory: FullContentAssetChannelCategory =
      await this.contentAssetChannelCategories.update(
        categoryId,
        request.category,
      );

    const responseBody: UpdateContentAssetChannelCategoryResponse = {
      category: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
