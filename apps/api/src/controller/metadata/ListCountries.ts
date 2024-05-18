import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  Country,
  ListCountriesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/metadata/CountryConverter";
import { GraphQlCountry } from "../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../utils/controllerDecorators";

type GraphQlListCountriesResponse = {
  dionysus_countries: GraphQlCountry[];
  dionysus_countries_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller()
export class ListCountriesController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/metadata/countries")
  @ApiOperation({
    summary: "Lists countries",
    description:
      "Lists countries.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of countries fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListCountries",
  })
  @ApiTags("Metadata")
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of countries.  If there are more countries to list, a pagination token will be present.",
    type: () => ListCountriesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListCountries {
      dionysus_countries(limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}) {
        createdTime
        id
        lastUpdatedTime
        name
      }
      dionysus_countries_aggregate {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListCountriesResponse>(
        fetchRequest,
      );
    const fetchedCountries: Country[] = [];

    fetchResponse.dionysus_countries.forEach((result) => {
      fetchedCountries.push(toDomainObject(result));
    });

    const responseBody: ListCountriesResponse = {
      countries: fetchedCountries,
      count: fetchResponse.dionysus_countries_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
