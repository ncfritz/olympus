import {
  BaseTVSeries,
  ListNetworkTvSeriesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseDomainObject } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { GraphQlBaseTvSeries } from "../../../../types/dionysus/metadata/tvSeries";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

type GraphQlListNetworkTvSeriesResponse = {
  dionysus_networks_by_pk: {
    tvSeries: {
      tvSeries: GraphQlBaseTvSeries;
    }[];
    tvSeries_aggregate: {
      aggregate: {
        count: number;
      };
    };
  };
};

@Controller({ version: "1" })
export class ListNetworkTvSeriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/network/:networkId/tvSeries")
  @ApiOperation({
    summary: "Lists the TV series associated with a network",
    description:
      "Lists the TV Series associated with a network.  This API accepts pagination parameters, but does not " +
      "offer filtering capabilities.",
    operationId: "ListNetworkTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiPaginationParams()
  @ApiParam({
    name: "networkId",
    description: "The ID of the network to list TV Series for",
    type: Number,
  })
  @ApiOkResponse({
    type: ListNetworkTvSeriesResponse,
    description:
      "The list of TV series for the network.  If there are more TV series to list, a pagination token will " +
      "be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("networkId") networkId: number,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const queryParams = [
      `limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}`,
    ];

    const fetchRequest = gql`
      query ListNetworkTvSeries($id: numeric!) {
        dionysus_networks_by_pk(id: $id) {
          tvSeries(${queryParams.join(", ")}) {
            tvSeries {
              adult
              backdropPath
              createdTime
              firstAirDate
              homepage
              id
              inProduction
              lastAirDate
              lastEpisodeToAirId
              lastUpdatedTime
              name
              numberOfEpisodes
              numberOfSeasons
              originalName
              original_language
              overview
              posterPath
              status
              tagline
              type
            }
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListNetworkTvSeriesResponse>(
        fetchRequest,
        {
          id: networkId,
        },
      );
    const tvSeries: BaseTVSeries[] = [];

    fetchResponse.dionysus_networks_by_pk.tvSeries.forEach((result) => {
      tvSeries.push(toBaseDomainObject(result.tvSeries));
    });

    const responseBody: ListNetworkTvSeriesResponse = {
      tvSeries: tvSeries,
      count:
        fetchResponse.dionysus_networks_by_pk.tvSeries_aggregate.aggregate
          .count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
