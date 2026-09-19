import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  CreateMetadataFetchJobRequest,
  GetMetadataFetchJobStatusStatisticsResponse,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadataJobType,
  Series,
  UpdateMetadataFetchJobRequest,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { METADATA_CATEGORY_MAP } from "../../../../utils/constants";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";
import { toDomainObject } from "../converters/MetadataFetchJobConverter";

type GraphQlCreateMetadataFetchJobRespons = {
  insert_dionysus_metadata_fetch_status_one: GraphQlMetadataFetchJob;
};

type GraphQlDeleteMetadataFetchJobRespons = {
  delete_dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob;
};

type GraphQlGetMetadataFetchJobResponse = {
  dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob;
};

type GraphQlGetMetadataJobStats = {
  dionysus_metadata_fetch_status_statistics: [
    { count: number; status: MetadataFetchJobStatus; type: MetadataJobType },
  ];
  dionysus_metadata_fetch_status_expiration_statistics: [
    { count: number; ttl_days: number; type: MetadataJobType },
  ];
};

type GraphQlUpdateMetadataFetchJobResponse = {
  update_dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob | null;
};

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

/** A page of metadata fetch jobs and the total number of matching jobs. */
export type MetadataFetchJobPage = { jobs: MetadataFetchJob[]; count: number };

/** Dionysus metadata fetch jobs in Hasura, and their trigger messages. */
@Injectable()
export class MetadataFetchJobService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  /** Creates (or requeues) a fetch job and, unless disabled, publishes its trigger. */
  async create(
    request: CreateMetadataFetchJobRequest,
  ): Promise<MetadataFetchJob> {
    const ttl = request.ttl ?? 30;
    const jitter = request.jitter ?? Math.floor(Math.random() * 3 * 24 * 60); // 3 days

    const insertRequest = gql`
      mutation CreateMetadataFetchJob(
        $id: String
        $type: String
        $status: String
        $ttl: numeric
        $jitter: numeric
        $lastFetchedTime: timestamptz
        $context: String
      ) {
        insert_dionysus_metadata_fetch_status_one(
          object: {
            id: $id
            type: $type
            status: $status
            ttl: $ttl
            jitter: $jitter
            lastFetchedTime: $lastFetchedTime
            context: $context
          }
          on_conflict: {
            constraint: metadata_locks_pkey
            update_columns: [status, ttl, jitter, lastFetchedTime]
          }
        ) {
          id
          type
          status
          createdTime
          lastUpdatedTime
          lastFetchedTime
          ttl
          jitter
          context
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataFetchJobRespons>(
        insertRequest,
        {
          id: request.id,
          type: request.type,
          status: request.status || MetadataFetchJobStatus.QUEUED,
          lastFetchedTime: request.lastFetchedTime,
          ttl: ttl,
          jitter: jitter,
          context: request.context
            ? Buffer.from(JSON.stringify(request.context), "utf-8").toString(
                "base64",
              )
            : undefined,
        },
      );

    const createdJob: MetadataFetchJob = toDomainObject(
      insertResponse.insert_dionysus_metadata_fetch_status_one,
    );

    if (request.publishNotification ?? true) {
      await this.amqpConnection.publish(
        "metadataJob.trigger",
        `jobType.${createdJob.type}`,
        {
          entityId: createdJob.id,
          entityType: createdJob.type,
          bypassCache: request.bypassCache,
        },
        {
          persistent: true,
          headers: {
            "x-delay": 10000,
          },
        },
      );
    }

    return createdJob;
  }

  /** @throws NotFoundException */
  async describe(
    entityId: string,
    entityType: MetadataJobType,
  ): Promise<MetadataFetchJob> {
    const fetchRequest = gql`
      query FetchMetadataFetchJob($id: String!, $type: String!) {
        dionysus_metadata_fetch_status_by_pk(id: $id, type: $type) {
          id
          type
          status
          createdTime
          lastUpdatedTime
          lastFetchedTime
          ttl
          jitter
          context
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataFetchJobResponse>(
        fetchRequest,
        {
          id: entityId,
          type: entityType,
        },
      );

    if (!fetchResponse.dionysus_metadata_fetch_status_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_metadata_fetch_status_by_pk);
  }

  /**
   * Applies `request.job` to a fetch job and publishes its trigger when it is
   * queued, unless disabled. @throws NotFoundException
   */
  async update(
    entityId: string,
    entityType: MetadataJobType,
    request: Partial<UpdateMetadataFetchJobRequest>,
  ): Promise<MetadataFetchJob> {
    const updateRequest = gql`
      mutation UpdateMetadataFetchJob(
        $id: String!
        $type: String!
        $changes: dionysus_metadata_fetch_status_set_input = {}
      ) {
        update_dionysus_metadata_fetch_status_by_pk(
          pk_columns: { id: $id, type: $type }
          _set: $changes
        ) {
          id
          type
          status
          createdTime
          lastUpdatedTime
          lastFetchedTime
          ttl
          jitter
          context
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMetadataFetchJobResponse>(
        updateRequest,
        {
          id: entityId,
          type: entityType,
          changes: request.job,
        },
      );

    if (!updateResponse.update_dionysus_metadata_fetch_status_by_pk) {
      throw new NotFoundException();
    }

    const updatedJob: MetadataFetchJob = toDomainObject(
      updateResponse.update_dionysus_metadata_fetch_status_by_pk,
    );

    if (
      updatedJob.status === MetadataFetchJobStatus.QUEUED &&
      (request.publishNotification ?? true)
    ) {
      await this.amqpConnection.publish(
        "metadataJob.trigger",
        `jobType.${updatedJob.type}`,
        {
          entityId: updatedJob.id,
          entityType: updatedJob.type,
          bypassCache: request.bypassCache,
        },
        {
          persistent: true,
          headers: {
            "x-delay": 10000,
          },
        },
      );
    }

    return updatedJob;
  }

  /** @throws NotFoundException */
  async delete(
    entityId: string,
    entityType: string,
  ): Promise<MetadataFetchJob> {
    const deleteRequest = gql`
      mutation DeleteFetchJob($id: String!, $type: String!) {
        delete_dionysus_metadata_fetch_status_by_pk(id: $id, type: $type) {
          createdTime
          id
          jitter
          lastFetchedTime
          lastUpdatedTime
          status
          ttl
          type
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlDeleteMetadataFetchJobRespons>(
        deleteRequest,
        {
          id: entityId,
          type: entityType,
        },
      );

    if (!fetchResponse.delete_dionysus_metadata_fetch_status_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      fetchResponse.delete_dionysus_metadata_fetch_status_by_pk,
    );
  }

  /** A page of fetch jobs matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters?: string,
  ): Promise<MetadataFetchJobPage> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMetadataFetchJobs {
      dionysus_metadata_fetch_status(${[paginationExpression, whereExpression].join(", ")}) {
        createdTime
        id
        jitter
        lastFetchedTime
        lastUpdatedTime
        status
        ttl
        type
      }
      dionysus_metadata_fetch_status_aggregate${whereExpression ? `(${whereExpression})` : ""} {
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

    return {
      jobs: fetchedJobs,
      count:
        fetchResponse.dionysus_metadata_fetch_status_aggregate.aggregate.count,
    };
  }

  /**
   * Fetch jobs ordered by ID after `lastSeenId`, filtered by `filters`
   * (base64 JSON of column to allowed values). @throws BadRequestException
   */
  async scroll(
    filters: string | undefined,
    pageSize: number,
    lastSeenId: string | undefined,
  ): Promise<MetadataFetchJobPage> {
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

    return {
      jobs: fetchedJobs,
      count:
        fetchResponse.dionysus_metadata_fetch_status_aggregate.aggregate.count,
    };
  }

  /** Job counts by type and status, and by type and days until expiry. */
  async getStatistics(): Promise<GetMetadataFetchJobStatusStatisticsResponse> {
    const fetchRequest = gql`
      query GetMetadataFetchJobStatistics {
        dionysus_metadata_fetch_status_statistics {
          count
          status
          type
        }
        dionysus_metadata_fetch_status_expiration_statistics {
          count
          ttl_days
          type
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataJobStats>(
        fetchRequest,
      );

    const statusCategories: string[] = Object.values(METADATA_CATEGORY_MAP);
    const statusSeries: Record<MetadataFetchJobStatus, number[]> = {
      [MetadataFetchJobStatus.QUEUED]: new Array(statusCategories.length).fill(
        0,
        0,
      ),
      [MetadataFetchJobStatus.INVALIDATED]: new Array(
        statusCategories.length,
      ).fill(0, 0),
      [MetadataFetchJobStatus.FETCHING]: new Array(
        statusCategories.length,
      ).fill(0, 0),
      [MetadataFetchJobStatus.CANCELLED]: new Array(
        statusCategories.length,
      ).fill(0, 0),
      [MetadataFetchJobStatus.FETCHED]: new Array(statusCategories.length).fill(
        0,
        0,
      ),
      [MetadataFetchJobStatus.FAILED]: new Array(statusCategories.length).fill(
        0,
        0,
      ),
      [MetadataFetchJobStatus.NOT_FOUND]: new Array(
        statusCategories.length,
      ).fill(0, 0),
    };

    fetchResponse.dionysus_metadata_fetch_status_statistics.forEach((data) => {
      const seriesIndex = Object.keys(METADATA_CATEGORY_MAP).indexOf(data.type);

      if (seriesIndex > -1) {
        statusSeries[data.status][seriesIndex] = data.count as number;
      }
    });

    const expirationSeries: Series[] = Object.keys(METADATA_CATEGORY_MAP).map(
      (category) => {
        return {
          name: category,
          data: new Array(26).fill(0, 0),
        };
      },
    );

    fetchResponse.dionysus_metadata_fetch_status_expiration_statistics.forEach(
      (data) => {
        const seriesIndex = expirationSeries.findIndex(
          (value) => data.type === value.name,
        );

        if (seriesIndex > -1) {
          expirationSeries[seriesIndex].data[data.ttl_days] =
            data.count as number;
        }
      },
    );

    const modeledResponse: GetMetadataFetchJobStatusStatisticsResponse = {
      status: {
        categories: statusCategories,
        series: statusSeries,
      },
      expiration: {
        series: expirationSeries,
      },
    };

    return modeledResponse;
  }
}
