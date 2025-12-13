import {
  ListNetworksResponse,
  NetworkWithContentCounts,
  SortDirection,
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
import { toDomainObjectWithContentCounts } from "../../../../convert/dionysus/metadata/NetworkConverter";
import { GraphQlNetworkWithContentCounts } from "../../../../types/dionysus/metadata/tvNetworks";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

type GraphQlListNetworksResponse = {
  dionysus_networks: GraphQlNetworkWithContentCounts[];
  dionysus_networks_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListNetworksController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/networks")
  @ApiOperation({
    summary: "Lists TV networks",
    description:
      "Lists TV networks.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of companies fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListNetworks",
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
    type: ListNetworksResponse,
    description:
      "The list of TV networks.  If there are more companies to list, a pagination token will be present.",
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
      query ListNetworks {
        dionysus_networks(${queryParams.join(", ")}) {
          country {
            createdTime
            lastUpdatedTime
            name
            id
          }
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          createdTime
          headquarters
          homepage
          id
          logo
          name
          lastUpdatedTime
          images {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_networks_aggregate${where ? `(${where})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListNetworksResponse>(
        fetchRequest,
      );
    const networks: NetworkWithContentCounts[] = [];

    fetchResponse.dionysus_networks.forEach((result) => {
      networks.push(toDomainObjectWithContentCounts(result));
    });

    const responseBody: ListNetworksResponse = {
      networks: networks,
      count: fetchResponse.dionysus_networks_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
