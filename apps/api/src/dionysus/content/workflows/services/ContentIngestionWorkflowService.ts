import { dionysusConfig } from "../../../../config/configuration";
import type { DionysusConfigType } from "../../../../config/configuration";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BaseContentIngestionWorkflowStep,
  ContentIngestionWorkflow,
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStep,
  ContentIngestionWorkflowStepStatus,
  GetContentIngestionWorkflowStatisticsResponse,
  ListContentIngestionWorkflowsResponse,
  PartialContentIngestionWorkflow,
  PartialContentIngestionWorkflowStep,
} from "@ncfritz/olympus-model";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  dailyIndex,
  emptyDailySeries,
  startOfTodayUtc,
} from "../../../../utils/dailySeries";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toDomainObject } from "../converters/ContentIngestionWorkflowConverter";
import { toDomainObject as toStepDomainObject } from "../converters/ContentIngestionWorkflowStepConverter";
import {
  GraphQLContentIngestionWorkflow,
  GraphQlContentIngestionWorkflowStep,
} from "../types/workflow";

type GraphQlGetParentContentIngestionWorkflowIdResponse = {
  dionysus_content_asset_ingest_workflows_by_pk: {
    id: string;
  };
};

type GraphQlGetParentContentIngestionWorkflowStepIdResponse = {
  dionysus_content_asset_ingest_workflow_steps_by_pk: {
    id: string;
  };
};

type GraphQlCreateMetadataWorkflowResponse = {
  insert_dionysus_content_asset_ingest_workflows_one: GraphQLContentIngestionWorkflow;
};

type GraphQlGetContentIngestionWorkflowResponse = {
  dionysus_content_asset_ingest_workflows_by_pk: GraphQLContentIngestionWorkflow;
};

type GraphQLListContentIngestionWorkflowsResponse = {
  dionysus_content_asset_ingest_workflows: GraphQLContentIngestionWorkflow[];
  dionysus_content_asset_ingest_workflows_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlUpdateContentIngestionWorkflowResponse = {
  update_dionysus_content_asset_ingest_workflows_by_pk: GraphQLContentIngestionWorkflow | null;
};

type GraphQlCreateContentIngestionWorkflowStepResponse = {
  insert_dionysus_content_asset_ingest_workflow_steps_one: GraphQlContentIngestionWorkflowStep;
};

type GraphQlUpdateContentIngestionWorkflowStepResponse = {
  update_dionysus_content_asset_ingest_workflow_steps_by_pk: GraphQlContentIngestionWorkflowStep;
};

type GraphQlGetContentIngestionWorkflowStats = {
  dionysus_content_asset_ingest_workflow_status_statistics: [
    {
      count: number;
      createdTime: string;
      status: ContentIngestionWorkflowStatus;
    },
  ];
  dionysus_content_asset_ingest_workflow_status_aggregate: [
    {
      count: number;
      status: ContentIngestionWorkflowStatus;
    },
  ];
  dionysus_content_asset_ingest_workflow_source_aggregate: [
    {
      count: number;
      sourceType: ContentIngestionWorkflowAssetLocation;
    },
  ];
};

/** An uploaded file: the client's file name and the stored file name. */
export type UploadedAsset = {
  originalName: string;
  filename: string;
};

/**
 * Content ingestion workflows (and their steps) in Hasura. Creating a
 * workflow publishes a rawIngest job for it.
 */
@Injectable()
export class ContentIngestionWorkflowService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
    @Inject(dionysusConfig.KEY)
    private readonly dionysus: DionysusConfigType,
  ) {}

  /** Creates a workflow for `source` and publishes its rawIngest job. */
  async create(
    source: string,
    sourceType: ContentIngestionWorkflowAssetLocation,
  ): Promise<ContentIngestionWorkflow> {
    const createdWorkflow = await this.createContentIngestionWorkflow(
      source,
      sourceType,
    );

    await this.amqpConnection.publish("content.trigger", "jobType.rawIngest", {
      workflowId: createdWorkflow.id,
      assetLocation: source,
      skipWorkflow: false,
    });

    return createdWorkflow;
  }

  /**
   * Creates a workflow for each uploaded file (stored in the upload
   * directory) and publishes its rawIngest job.
   */
  async createForUploads(
    files: UploadedAsset[],
  ): Promise<ContentIngestionWorkflow[]> {
    const workflows: ContentIngestionWorkflow[] = [];

    for (const file of files) {
      const workflow = await this.createContentIngestionWorkflow(
        file.originalName,
        ContentIngestionWorkflowAssetLocation.LOCAL,
      );
      await this.amqpConnection.publish(
        "content.trigger",
        "jobType.rawIngest",
        {
          workflowId: workflow.id,
          assetLocation: `${this.dionysus.publishPath}/${file.filename}`,
          originalFilename: file.originalName,
          skipWorkflow: false,
        },
      );
      workflows.push(workflow);
    }

    return workflows;
  }

  /** @throws NotFoundException */
  async describe(workflowId: string): Promise<ContentIngestionWorkflow> {
    const fetchRequest = gql`
      query DescribeContentIngestionWorkflow($id: uuid!) {
        dionysus_content_asset_ingest_workflows_by_pk(id: $id) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          source
          sourceType
          startedTime
          status
          steps_aggregate {
            aggregate {
              count
            }
          }
          steps(order_by: { createdTime: asc }) {
            createdTime
            finishedTime
            id
            lastUpdatedTime
            progress
            startedTime
            status
            type
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetContentIngestionWorkflowResponse>(
        fetchRequest,
        {
          id: workflowId,
        },
      );

    if (!fetchResponse.dionysus_content_asset_ingest_workflows_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      fetchResponse.dionysus_content_asset_ingest_workflows_by_pk,
    );
  }

  /** A page of workflows matching `filters`, with the total match count. */
  async list(
    filters: string | undefined,
    pagination: PaginationParams,
  ): Promise<ListContentIngestionWorkflowsResponse> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListContentIngestionWorkflows {
        dionysus_content_asset_ingest_workflows(${[paginationExpression, whereExpression].join(", ")}) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          source
          sourceType
          startedTime
          status
          steps_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_content_asset_ingest_workflows_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQLListContentIngestionWorkflowsResponse>(
        fetchRequest,
      );
    const fetchedWorkflows: ContentIngestionWorkflow[] = [];

    fetchResponse.dionysus_content_asset_ingest_workflows.forEach((result) => {
      fetchedWorkflows.push(toDomainObject(result));
    });

    return {
      workflows: fetchedWorkflows,
      count:
        fetchResponse.dionysus_content_asset_ingest_workflows_aggregate
          .aggregate.count,
    };
  }

  /**
   * Applies `updates` to a workflow, setting finishedTime when it moves to a
   * final status without one. @throws NotFoundException
   */
  async update(
    workflowId: string,
    updates: PartialContentIngestionWorkflow,
  ): Promise<ContentIngestionWorkflow> {
    const updateRequest = gql`
      mutation UpdateContentIngestionWorkflow(
        $id: uuid!
        $changes: dionysus_content_asset_ingest_workflows_set_input = {}
      ) {
        update_dionysus_content_asset_ingest_workflows_by_pk(
          pk_columns: { id: $id }
          _set: $changes
        ) {
          id
          source
          sourceType
          tempLocation
          status
          startedTime
          finishedTime
          createdTime
          lastUpdatedTime
          steps {
            id
            type
            status
            progress
            startedTime
            finishedTime
            createdTime
            lastUpdatedTime
          }
        }
      }
    `;

    if (
      updates.status &&
      [
        ContentIngestionWorkflowStatus.SKIPPED,
        ContentIngestionWorkflowStatus.FAILED,
        ContentIngestionWorkflowStatus.SUCCESS,
      ].includes(updates.status) &&
      !updates.finishedTime
    ) {
      updates.finishedTime = moment().utc();
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentIngestionWorkflowResponse>(
        updateRequest,
        {
          id: workflowId,
          changes: updates,
        },
      );

    if (!updateResponse.update_dionysus_content_asset_ingest_workflows_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      updateResponse.update_dionysus_content_asset_ingest_workflows_by_pk,
    );
  }

  /** Daily status counts for the chart window, and status/source totals. */
  async getStatistics(): Promise<GetContentIngestionWorkflowStatisticsResponse> {
    const fetchRequest = gql`
      query GetContentIngestionWorkflowStatistics {
        dionysus_content_asset_ingest_workflow_status_statistics {
          count
          status
          createdTime
        }
        dionysus_content_asset_ingest_workflow_status_aggregate {
          count
          status
        }
        dionysus_content_asset_ingest_workflow_source_aggregate {
          count
          sourceType
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetContentIngestionWorkflowStats>(
        fetchRequest,
      );

    const today = startOfTodayUtc();

    const statusSeries = {
      [ContentIngestionWorkflowStatus.QUEUED]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.RUNNING]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.SUCCESS]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.FAILED]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.SKIPPED]: emptyDailySeries(today),
      [ContentIngestionWorkflowStatus.DUPLICATE]: emptyDailySeries(today),
    };
    const statusAggregateSeries: Record<
      ContentIngestionWorkflowStatus,
      number
    > = {
      [ContentIngestionWorkflowStatus.QUEUED]: 0,
      [ContentIngestionWorkflowStatus.RUNNING]: 0,
      [ContentIngestionWorkflowStatus.SUCCESS]: 0,
      [ContentIngestionWorkflowStatus.FAILED]: 0,
      [ContentIngestionWorkflowStatus.SKIPPED]: 0,
      [ContentIngestionWorkflowStatus.DUPLICATE]: 0,
    };
    const sourceAggregateSeries: Record<
      ContentIngestionWorkflowAssetLocation,
      number
    > = {
      [ContentIngestionWorkflowAssetLocation.REMOTE]: 0,
      [ContentIngestionWorkflowAssetLocation.LOCAL]: 0,
    };

    fetchResponse.dionysus_content_asset_ingest_workflow_status_statistics.forEach(
      (data) => {
        const dataTime = moment.utc(data.createdTime);
        const dateIndex = dailyIndex(today, dataTime);
        if (dateIndex === undefined || !(data.status in statusSeries)) return;

        statusSeries[data.status][dateIndex] = [dataTime.valueOf(), data.count];
      },
    );

    fetchResponse.dionysus_content_asset_ingest_workflow_status_aggregate.forEach(
      (data) => {
        statusAggregateSeries[data.status] = data.count;
      },
    );

    fetchResponse.dionysus_content_asset_ingest_workflow_source_aggregate.forEach(
      (data) => {
        sourceAggregateSeries[data.sourceType] = data.count;
      },
    );

    const modeledResponse: GetContentIngestionWorkflowStatisticsResponse = {
      categories: {
        status: [
          ContentIngestionWorkflowStatus.QUEUED,
          ContentIngestionWorkflowStatus.RUNNING,
          ContentIngestionWorkflowStatus.SUCCESS,
          ContentIngestionWorkflowStatus.FAILED,
          ContentIngestionWorkflowStatus.SKIPPED,
          ContentIngestionWorkflowStatus.DUPLICATE,
        ],
        source: [
          ContentIngestionWorkflowAssetLocation.REMOTE,
          ContentIngestionWorkflowAssetLocation.LOCAL,
        ],
      },
      series: {
        status: statusSeries,
        statusAggregate: statusAggregateSeries,
        sourceAggregate: sourceAggregateSeries,
      },
    };

    return modeledResponse;
  }

  /** Adds a running step to a workflow. @throws NotFoundException */
  async createStep(
    workflowId: string,
    step: BaseContentIngestionWorkflowStep,
  ): Promise<ContentIngestionWorkflowStep> {
    await this.verifyWorkflowExists(workflowId);
    const insertRequest = gql`
      mutation CreateContentIngestionWorkflowStep(
        $workflowId: uuid!
        $workflowStepType: String!
        $workflowStepStatus: String!
        $progress: numeric!
        $startedTime: timestamptz!
      ) {
        insert_dionysus_content_asset_ingest_workflow_steps_one(
          object: {
            workflow_id: $workflowId
            type: $workflowStepType
            status: $workflowStepStatus
            progress: $progress
            startedTime: $startedTime
          }
        ) {
          id
          type
          status
          progress
          startedTime
          finishedTime
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateContentIngestionWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          workflowStepType: step.type,
          workflowStepStatus: ContentIngestionWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    return toStepDomainObject(
      insertResponse.insert_dionysus_content_asset_ingest_workflow_steps_one,
    );
  }

  /** Applies `changes` to a workflow step. @throws NotFoundException */
  async updateStep(
    workflowId: string,
    workflowStepId: string,
    changes: PartialContentIngestionWorkflowStep,
  ): Promise<ContentIngestionWorkflowStep> {
    await this.verifyWorkflowExists(workflowId);
    await this.verifyWorkflowStepExists(workflowId, workflowStepId);
    const updateRequest = gql`
      mutation UpdateContentIngestionWorkflowStep(
        $id: uuid!
        $workflowId: uuid!
        $changes: dionysus_content_asset_ingest_workflow_steps_set_input = {}
      ) {
        update_dionysus_content_asset_ingest_workflow_steps_by_pk(
          pk_columns: { id: $id, workflow_id: $workflowId }
          _set: $changes
        ) {
          id
          type
          status
          progress
          startedTime
          finishedTime
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentIngestionWorkflowStepResponse>(
        updateRequest,
        {
          id: workflowStepId,
          workflowId: workflowId,
          changes: changes,
        },
      );

    return toStepDomainObject(
      updateResponse.update_dionysus_content_asset_ingest_workflow_steps_by_pk,
    );
  }

  private async createContentIngestionWorkflow(
    source: string,
    sourceType: ContentIngestionWorkflowAssetLocation,
  ): Promise<ContentIngestionWorkflow> {
    const insertRequest = gql`
      mutation CreateContentIngestionWorkflow(
        $status: String!
        $source: String!
        $sourceType: String!
      ) {
        insert_dionysus_content_asset_ingest_workflows_one(
          object: { status: $status, source: $source, sourceType: $sourceType }
        ) {
          id
          source
          sourceType
          status
          startedTime
          finishedTime
          createdTime
          lastUpdatedTime
          steps {
            id
            type
            status
            progress
            startedTime
            finishedTime
            createdTime
            lastUpdatedTime
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataWorkflowResponse>(
        insertRequest,
        {
          source: source,
          sourceType: sourceType,
          status: ContentIngestionWorkflowStatus.QUEUED,
        },
      );

    return toDomainObject(
      insertResponse.insert_dionysus_content_asset_ingest_workflows_one,
    );
  }

  private async verifyWorkflowExists(workflowId: string) {
    const checkParentWorkflowRequest = gql`
      query GetParentContentIngestionWorkflow($id: uuid!) {
        dionysus_content_asset_ingest_workflows_by_pk(id: $id) {
          id
        }
      }
    `;

    const checkParentWorkflowResponse =
      await this.graphQLClient.request<GraphQlGetParentContentIngestionWorkflowIdResponse>(
        checkParentWorkflowRequest,
        { id: workflowId },
      );

    if (
      !checkParentWorkflowResponse.dionysus_content_asset_ingest_workflows_by_pk
        ?.id
    ) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }
  }

  private async verifyWorkflowStepExists(
    workflowId: string,
    workflowStepId: string,
  ) {
    const checkWorkflowStepRequest = gql`
      query GetParentContentIngestionWorkflowStep(
        $id: uuid!
        $workflowId: uuid!
      ) {
        dionysus_content_asset_ingest_workflow_steps_by_pk(
          id: $id
          workflow_id: $workflowId
        ) {
          id
        }
      }
    `;

    const checkWorkflowStepResponse =
      await this.graphQLClient.request<GraphQlGetParentContentIngestionWorkflowStepIdResponse>(
        checkWorkflowStepRequest,
        { id: workflowStepId, workflowId: workflowId },
      );

    if (
      !checkWorkflowStepResponse
        .dionysus_content_asset_ingest_workflow_steps_by_pk?.id
    ) {
      throw new NotFoundException(
        `Workflow step ${workflowId}/${workflowStepId} not found`,
      );
    }
  }
}
