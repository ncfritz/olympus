import {
  BaseTVSeries,
  ListProductionCompanyTvSeriesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseDomainObject } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { GraphQlBaseTvSeries } from "../../../../types/dionysus/metadata/tvSeries";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { buildPaginationExpression } from "../../../../utils/filterUtil";

type GraphQlListProductionCompanyTvSeriesResponse = {
  dionysus_production_companies_by_pk: {
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
export class ListProductionCompanyTvSeriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/productionCompany/:productionCompanyId/tvSeries")
  @ApiOperation({
    summary: "Lists the TV series associated with a production company",
    description:
      "Lists the TV Series associated with a production company.  This API accepts pagination parameters, but does not " +
      "offer filtering capabilities.",
    operationId: "ListProductionCompanyTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiPaginationParams()
  @ApiParam({
    name: "productionCompanyId",
    description: "The ID of the production company to list tvSeries for",
    type: Number,
  })
  @ApiOkResponse({
    type: ListProductionCompanyTvSeriesResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("productionCompanyId", ParseIntPipe) productionCompanyId: number,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const paginationExpression = buildPaginationExpression({
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });
    const queryParams = [paginationExpression];

    const fetchRequest = gql`
      query ListProductionCompanyTvSeries($id: numeric!) {
        dionysus_production_companies_by_pk(id: $id) {
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
              popularity
              posterPath
              status
              tagline
              type
              voteAverage
              voteCount
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
      await this.graphQLClient.request<GraphQlListProductionCompanyTvSeriesResponse>(
        fetchRequest,
        {
          id: productionCompanyId,
        },
      );
    if (!fetchResponse.dionysus_production_companies_by_pk) {
      throw new NotFoundException();
    }

    const tvSeries: BaseTVSeries[] = [];

    fetchResponse.dionysus_production_companies_by_pk.tvSeries.forEach(
      (result) => {
        // Skip links to rows that are not in the database (yet).
        if (result.tvSeries) {
          tvSeries.push(toBaseDomainObject(result.tvSeries));
        }
      },
    );

    const responseBody: ListProductionCompanyTvSeriesResponse = {
      tvSeries: tvSeries,
      count:
        fetchResponse.dionysus_production_companies_by_pk.tvSeries_aggregate
          .aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
