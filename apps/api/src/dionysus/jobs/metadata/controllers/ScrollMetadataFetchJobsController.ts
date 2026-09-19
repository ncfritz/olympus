import {
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListMetadataJobsResponse = {
  dionysus_metadata_fetch_status: GraphQlMetadataFetchJob[];
  dionysus_metadata_fetch_status_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

const FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * `filters` is base64-encoded JSON mapping a column to the values it may
 * take, e.g. `{"status": ["queued"], "type": ["movies"]}`.
 */
const parseScrollFilters = (
  filters: string | undefined,
): Record<string, (string | number)[]> => {
  if (!filters) {
    return {};
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(filters, "base64").toString("utf-8"));
  } catch {
    throw new BadRequestException("`filters` must be base64-encoded JSON");
  }

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new BadRequestException("`filters` must be a JSON object");
  }

  for (const [field, values] of Object.entries(decoded)) {
    if (
      !FIELD.test(field) ||
      !Array.isArray(values) ||
      !values.every((v) => typeof v === "string" || typeof v === "number")
    ) {
      throw new BadRequestException(`Invalid filter "${field}"`);
    }
  }

  return decoded as Record<string, (string | number)[]>;
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
    @Query("filters") filters: string | undefined,
    @Query("pageSize", new DefaultValuePipe(100), ParseIntPipe)
    pageSize: number,
    @Query("lastSeenId") lastSeenId: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (pageSize < 0) {
      throw new BadRequestException(`Invalid page size "${pageSize}"`);
    }

    const conditions: Record<string, unknown>[] = [];

    if (lastSeenId) {
      conditions.push({ id: { _gt: lastSeenId } });
    }

    for (const [field, values] of Object.entries(parseScrollFilters(filters))) {
      if (values.length > 0) {
        conditions.push({ [field]: { _in: values } });
      }
    }

    const fetchRequest = gql`
      query ScrollMetadataFetchJobs(
        $limit: Int!
        $where: dionysus_metadata_fetch_status_bool_exp!
      ) {
        dionysus_metadata_fetch_status(
          limit: $limit
          order_by: { id: asc }
          where: $where
        ) {
          createdTime
          id
          jitter
          lastFetchedTime
          lastUpdatedTime
          status
          ttl
          type
        }
        dionysus_metadata_fetch_status_aggregate(where: $where) {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMetadataJobsResponse>(
        fetchRequest,
        { limit: pageSize, where: { _and: conditions } },
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
