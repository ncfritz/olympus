import {
  FilterDefinition,
  ListContentAssetChannelsForCategoryResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { parseFilterDefinition } from "../../../../utils/filterUtil";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";
import { contentAuthToken } from "../../auth/contentAuth";

@Controller({ version: "1" })
@ApiExtraModels(FilterDefinition)
export class ListContentAssetChannelsForCategoryController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Get("/content/channels/category/:categoryId/channels")
  @ApiOperation({
    summary: "Lists the content asset channels in a category",
    description: "Lists the content asset channels in a channel category.",
    operationId: "ListContentAssetChannelsForCategory",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "categoryId",
    description: "The ID of the channel category to describe",
    type: String,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetChannelsForCategoryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("categoryId") categoryId: string,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListContentAssetChannelsForCategoryResponse =
      await this.contentAssetChannels.listForCategory(
        categoryId,
        parseFilterDefinition(filters),
        {
          pageSize: pageSize,
          startPage: startPage,
          sortDirection: sortDirection,
          sortField: sortField,
        },
        contentAuthToken(request),
      );

    response.status(HttpStatus.OK).send(responseBody);
  }
}
