import {
  BaseTVSeries,
  ListTvSeriesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseDomainObject as toTvSeriesDomainObject } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { BASE_TV_SERIES } from "../../../../query/dionysus/metadata/tvSeries";
import { GraphQlBaseTvSeries } from "../../../../types/dionysus/metadata/tvSeries";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

type GraphQlListTvSeriesResponse = {
  dionysus_tv_series: GraphQlBaseTvSeries[];
};

@Controller({ version: "1" })
export class ListTvSeriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListTvSeries {
        dionysus_tv_series(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_TV_SERIES}
        }
        dionysus_tv_series_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesResponse>(
        fetchRequest,
      );
    const tvSeries: BaseTVSeries[] = [];

    fetchResponse.dionysus_tv_series.forEach((result) => {
      tvSeries.push(toTvSeriesDomainObject(result));
    });

    const responseBody: ListTvSeriesResponse = {
      tvSeries: tvSeries,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
