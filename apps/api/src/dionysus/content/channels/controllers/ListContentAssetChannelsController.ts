import {
  FilterDefinition,
  ListContentAssetChannelsResponse,
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
import { parseFilterDefinition } from "../../../../utils/filterUtil";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";

@Controller({ version: "1" })
@ApiExtraModels(FilterDefinition)
export class ListContentAssetChannelsController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Get("/content/channels")
  @ApiOperation({
    summary: "Lists content asset channels",
    description:
      "Lists content asset channels.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of  fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentAssetChannels",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetChannelsResponse,
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
    const responseBody: ListContentAssetChannelsResponse =
      await this.contentAssetChannels.list(
        parseFilterDefinition(filters),
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
