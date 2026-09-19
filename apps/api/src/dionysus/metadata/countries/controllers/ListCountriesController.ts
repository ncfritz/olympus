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
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/CountryConverter";
import { GraphQlCountry } from "../types/country";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { buildPaginationExpression } from "../../../../utils/filterUtil";

type GraphQlListCountriesResponse = {
  dionysus_countries: GraphQlCountry[];
  dionysus_countries_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListCountriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/countries")
  @ApiOperation({
    summary: "Lists countries",
    description:
      "Lists countries.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of countries fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListCountries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListCountriesResponse,
    description:
      "The list of countries.  If there are more countries to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
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
    const fetchRequest = gql`
      query ListCountries {
      dionysus_countries(${paginationExpression}) {
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
