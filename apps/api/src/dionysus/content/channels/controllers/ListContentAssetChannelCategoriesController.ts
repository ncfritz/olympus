import {
  FilterDefinition,
  ListContentAssetChannelCategoriesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { ContentAuth, Curtain } from "../../auth/contentAuthDecorators";
import { ContentCurtain } from "../../auth/ContentCurtain";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { ContentAssetChannelCategoryService } from "../services/ContentAssetChannelCategoryService";

@Controller({ version: "1" })
@ApiExtraModels(FilterDefinition)
export class ListContentAssetChannelCategoriesController {
  constructor(
    private readonly contentAssetChannelCategories: ContentAssetChannelCategoryService,
  ) {}

  @Get("/content/channels/categories")
  @ApiOperation({
    summary: "Lists content asset channel categories",
    description:
      "Lists content asset channel categories.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of categories fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentAssetChannelCategories",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetChannelCategoriesResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Curtain() curtain: ContentCurtain,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListContentAssetChannelCategoriesResponse =
      await this.contentAssetChannelCategories.list(
        filters,
        {
          pageSize: pageSize,
          startPage: startPage,
          sortDirection: sortDirection,
          sortField: sortField,
        },
        curtain,
      );

    response.status(HttpStatus.OK).send(responseBody);
  }
}
