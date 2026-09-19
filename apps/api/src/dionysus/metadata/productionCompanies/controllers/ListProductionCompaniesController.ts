import {
  ListProductionCompaniesResponse,
  SortDirection,
  SparseProductionCompanyWithContentCounts,
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
import { toSparseDomainObjectWithContentCounts } from "../converters/ProductionCompanyConverter";
import { GraphQlSparseProductionCompanyWithContentCounts } from "../types/productionCompany";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildPaginationExpression,
  buildFilterExpression,
  parseInFilters,
} from "../../../../utils/filterUtil";

type GraphQlListProductionCompaniesResponse = {
  dionysus_production_companies: GraphQlSparseProductionCompanyWithContentCounts[];
  dionysus_production_companies_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListProductionCompaniesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/productionCompanies")
  @ApiOperation({
    summary: "Lists production companies",
    description:
      "Lists production companies.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of companies fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListProductionCompanies",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "filters",
    type: String,
    required: false,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListProductionCompaniesResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const paginationExpression = buildPaginationExpression({
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });
    const queryParams = [paginationExpression];
    const where = buildFilterExpression(parseInFilters(filters));

    if (where) {
      queryParams.push(where);
    }

    const fetchRequest = gql`
      query ListProductionCompanies {
        dionysus_production_companies(${queryParams.join(", ")}) {
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          country {
            createdTime
            id
            lastUpdatedTime
            name
          }
          createdTime
          description
          headquarters
          homepage
          id
          lastUpdatedTime
          logo
          name
          movies_aggregate {
            aggregate {
              count
            }
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_production_companies_aggregate${where ? `(${where})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListProductionCompaniesResponse>(
        fetchRequest,
      );
    const companies: SparseProductionCompanyWithContentCounts[] = [];

    fetchResponse.dionysus_production_companies.forEach((result) => {
      companies.push(toSparseDomainObjectWithContentCounts(result));
    });

    const responseBody: ListProductionCompaniesResponse = {
      companies: companies,
      count:
        fetchResponse.dionysus_production_companies_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
