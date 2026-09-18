import {
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
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
import { toDomainObject } from "../../../../convert/dionysus/job/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListMetadataJobsResponse = {
  dionysus_metadata_fetch_status: GraphQlMetadataFetchJob[];
  dionysus_metadata_fetch_status_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ScrollMetadataFetchJobsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/jobs/metadata/scroll")
  @ApiOperation({
    summary:
      "Scrolls metadata fetch jobs using the last seen ID for pagination",
    description:
      "Lists metadata fetch jobs.  This API orders the job lexicographically by ID to implement scroll capabilities." +
      "The last seen ID can be passed in as an optional parameter, in which case the API will return the next page of" +
      "results where the IDs are greater than the supplied ID.",
    operationId: "ScrollMetadataFetchJobs",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "lastSeenId",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "filters",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "pageSize",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    type: ListMetadataFetchJobsResponse,
    description:
      "The list of metadata fetch jobs.  If there are more jobs to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("filters") filters = undefined,
    @Query("pageSize") pageSize = 100,
    @Query("lastSeenId") lastSeenId = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const queryParams = [`limit: ${pageSize}, order_by: {id: asc}`];
    const filterOptions = [];

    if (lastSeenId) {
      filterOptions.push(`id: {_gt: "${lastSeenId}"}`);
    }

    let where = undefined;

    if (filters) {
      const decodedOptions = JSON.parse(
        Buffer.from(filters, "base64").toString("utf-8"),
      );

      for (const key in decodedOptions) {
        if (decodedOptions[key] && decodedOptions[key].length > 0) {
          const values = decodedOptions[key].map((value: string) => {
            return `"${value}"`;
          });

          filterOptions.push(`${key}: { _in: [${values.join(", ")}]}`);
        }
      }
    }

    if (filterOptions.length > 0) {
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
