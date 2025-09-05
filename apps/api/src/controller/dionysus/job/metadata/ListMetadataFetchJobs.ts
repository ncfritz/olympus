import {
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
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
import { toDomainObject } from "../../../../convert/dionysus/job/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

type GraphQlListMetadataJobsResponse = {
  dionysus_metadata_fetch_status: GraphQlMetadataFetchJob[];
  dionysus_metadata_fetch_status_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMetadataFetchJobsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/jobs/metadata")
  @ApiOperation({
    summary: "Lists metadata fetch jobs",
    description:
      "Lists metadata fetch jobs.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of certifications fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListMetadataFetchJobs",
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
    type: ListMetadataFetchJobsResponse,
    description:
      "The list of metadata fetch jobs.  If there are more jobs to list, a pagination token will be present.",
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
      query ListMetadataFetchJobs {
      dionysus_metadata_fetch_status(${queryParams.join(", ")}) {
        createdTime
        id
        jitter
        lastFetchedTime
        lastUpdatedTime
        status
        ttl
        type
      }
      dionysus_metadata_fetch_status_aggregate${where ? `(${where})` : ""} {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMetadataJobsResponse>(
        fetchRequest,
      );
    const fetchedJobs: MetadataFetchJob[] = [];

    fetchResponse.dionysus_metadata_fetch_status.forEach((result) => {
      fetchedJobs.push(toDomainObject(result));
    });

    const responseBody: ListMetadataFetchJobsResponse = {
      jobs: fetchedJobs,
      count:
        fetchResponse.dionysus_metadata_fetch_status_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
