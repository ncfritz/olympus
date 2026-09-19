import { ListTvSeriesResponse, SortDirection } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class ListTvSeriesController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Get("/metadata/tvSeries")
  @ApiOperation({
    summary: "Lists TV series",
    description: "Lists TV series.",
    operationId: "ListTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListTvSeriesResponse,
    description: "The list of TV series.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "popularity",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const page = await this.tvSeries.list({
      pageSize,
      startPage,
      sortDirection,
      sortField,
      filters,
    });

    const responseBody: ListTvSeriesResponse = {
      tvSeries: page.tvSeries,
      count: page.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
