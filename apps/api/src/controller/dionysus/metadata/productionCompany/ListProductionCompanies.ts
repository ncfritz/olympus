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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toSparseDomainObjectWithContentCounts } from "../../../../convert/dionysus/metadata/ProductionCompanyConverter";
import { GraphQlSparseProductionCompanyWithContentCounts } from "../../../../types/dionysus/metadata/productionCompany";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

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
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const queryParams = [
      `limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}`,
    ];
    let where = undefined;

    if (filters) {
      const decodedOptions = JSON.parse(
        Buffer.from(filters, "base64").toString("utf-8"),
      );
      console.log(decodedOptions);

      const filterOptions = [];

      for (const key in decodedOptions) {
        if (decodedOptions[key] && decodedOptions[key].length > 0) {
          const values = decodedOptions[key].map((value: string) => {
            return `"${value}"`;
          });

          filterOptions.push(`${key}: { _in: [${values.join(", ")}]}`);
        }
      }

      where = `where: {_and: {${filterOptions.join(", ")}}}`;
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
