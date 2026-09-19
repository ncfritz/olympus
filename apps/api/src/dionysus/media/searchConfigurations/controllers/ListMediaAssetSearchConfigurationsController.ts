import {
  ListMediaAssetSearchConfigurationsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { parseFilterDefinition } from "../../../../utils/filterUtil";
import { MediaAssetSearchConfigurationService } from "../services/MediaAssetSearchConfigurationService";

@Controller({ version: "1" })
export class ListMediaAssetSearchConfigurationsController {
  constructor(
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  @Get("/media/searchConfigurations")
  @ApiOperation({
    summary: "Lists search configurations",
    description: "Lists search configurations.",
    operationId: "ListMediaAssetSearchConfigurations",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of search configurations.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetSearchConfigurationsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "lastExecutionTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    const responseBody: ListMediaAssetSearchConfigurationsResponse =
      await this.searchConfigurations.list(
        {
          pageSize: pageSize,
          startPage: startPage,
          sortDirection: sortDirection,
          sortField: sortField,
        },
        userFilters,
      );

    response.status(HttpStatus.OK).send(responseBody);
  }
}
