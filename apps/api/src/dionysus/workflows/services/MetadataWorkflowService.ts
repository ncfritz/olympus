import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  GetMetadataWorkflowStatisticsResponse,
  PartialWorkflow,
  Workflow,
  WorkflowStatus,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  dailyIndex,
  emptyDailySeries,
  startOfTodayUtc,
} from "../../../utils/dailySeries";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../utils/filterUtil";
import { toDomainObject } from "../converters/WorkflowConverter";
import { GraphQLWorkflow } from "../types/workflow";
import {
  BASE_METADATA_WORKFLOW,
  METADATA_WORKFLOW,
} from "../queries/workflows";
import { BASE_METADATA_WORKFLOW_STEP } from "../queries/workflowSteps";

type GraphQlCreateMetadataWorkflowResponse = {
  insert_dionysus_metadata_workflow_one: GraphQLWorkflow;
};

type GraphQlGetMetadataWorkflowResponse = {
  dionysus_metadata_workflow_by_pk: GraphQLWorkflow;
};

type GraphQlUpdateMetadataWorkflowResponse = {
  update_dionysus_metadata_workflow_by_pk: GraphQLWorkflow | null;
};

type GraphQLListMetadataWorkflowsResponse = {
  dionysus_metadata_workflow: GraphQLWorkflow[];
  dionysus_metadata_workflow_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlGetMetadataWorkflowStats = {
  dionysus_metadata_workflow_status_statistics: [
    { count: number; createdTime: string; status: WorkflowStatus },
  ];
  dionysus_metadata_workflow_statistics: [
    { count: number; createdTime: string; queueTime: number; runTime: number },
  ];
};

/** A page of metadata workflows and the total number of matching workflows. */
export type MetadataWorkflowPage = { workflows: Workflow[]; count: number };

/** Dionysus metadata workflows in Hasura, and their creation messages. */
@Injectable()
export class MetadataWorkflowService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  /** Creates a workflow and publishes its (delayed) creation message. */
  async create(): Promise<Workflow> {
    const insertRequest = gql`
      mutation CreateMetadataWorkflow($status: String!) {
        insert_dionysus_metadata_workflow_one(object: { status: $status }) {
          ${BASE_METADATA_WORKFLOW}
          steps {
            ${BASE_METADATA_WORKFLOW_STEP}
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataWorkflowResponse>(
        insertRequest,
        { status: WorkflowStatus.CREATED },
      );

    const createdWorkflow: Workflow = toDomainObject(
      insertResponse.insert_dionysus_metadata_workflow_one,
    );

    await this.amqpConnection.publish(
      "batchJob.workflow",
      `workflowCreated`,
      {
        workflowId: createdWorkflow.id,
      },
      {
        persistent: true,
        headers: {
          "x-delay": 15000,
        },
      },
    );

    return createdWorkflow;
  }

  /** @throws NotFoundException */
  async describe(workflowId: string): Promise<Workflow> {
    const fetchRequest = gql`
      query DescribeMetadataWorkflow($id: uuid!) {
        dionysus_metadata_workflow_by_pk(id: $id) {
          ${METADATA_WORKFLOW}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataWorkflowResponse>(
        fetchRequest,
        {
          id: workflowId,
        },
      );

    if (!fetchResponse.dionysus_metadata_workflow_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_metadata_workflow_by_pk);
  }

  /** Applies `changes` to a workflow. @throws NotFoundException */
  async update(
    workflowId: string,
    changes: PartialWorkflow,
  ): Promise<Workflow> {
    const updateRequest = gql`
      mutation UpdateMetadataWorkflow(
        $id: uuid!
        $changes: dionysus_metadata_workflow_set_input = {}
      ) {
        update_dionysus_metadata_workflow_by_pk(
          pk_columns: { id: $id }
          _set: $changes
        ) {
          ${METADATA_WORKFLOW}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMetadataWorkflowResponse>(
        updateRequest,
        {
          id: workflowId,
          changes: changes,
        },
      );

    if (!updateResponse.update_dionysus_metadata_workflow_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      updateResponse.update_dionysus_metadata_workflow_by_pk,
    );
  }

  /** A page of workflows matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters: string | undefined,
  ): Promise<MetadataWorkflowPage> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMetadataWorkflows {
        dionysus_metadata_workflow(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_METADATA_WORKFLOW}
          steps_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_metadata_workflow_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQLListMetadataWorkflowsResponse>(
        fetchRequest,
      );
    const fetchedWorkflows: Workflow[] = [];

    fetchResponse.dionysus_metadata_workflow.forEach((result) => {
      fetchedWorkflows.push(toDomainObject(result));
    });

    return {
      workflows: fetchedWorkflows,
      count: fetchResponse.dionysus_metadata_workflow_aggregate.aggregate.count,
    };
  }

  /** Daily status counts and timings of workflows. */
  async getStatistics(): Promise<GetMetadataWorkflowStatisticsResponse> {
    const fetchRequest = gql`
      query GetMetadataWorkflowStatistics {
        dionysus_metadata_workflow_status_statistics {
          count
          createdTime
          status
        }
        dionysus_metadata_workflow_statistics {
          count
          createdTime
          queueTime
          runTime
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataWorkflowStats>(
        fetchRequest,
      );

    const today = startOfTodayUtc();

    const statusSeries = {
      [WorkflowStatus.CREATED]: emptyDailySeries(today),
      [WorkflowStatus.STARTED]: emptyDailySeries(today),
      [WorkflowStatus.FAILED]: emptyDailySeries(today),
      [WorkflowStatus.SUCCESS]: emptyDailySeries(today),
      [WorkflowStatus.CANCELLED]: emptyDailySeries(today),
    };
    const queueTimeSeries: number[][] = emptyDailySeries(today);
    const runtimeSeries: number[][] = emptyDailySeries(today);

    fetchResponse.dionysus_metadata_workflow_statistics.forEach((data) => {
      const dataTime = moment.utc(data.createdTime);
      const dateIndex = dailyIndex(today, dataTime);
      if (dateIndex === undefined) return;

      queueTimeSeries[dateIndex] = [
        dataTime.valueOf(),
        data.queueTime as number,
      ];
      runtimeSeries[dateIndex] = [dataTime.valueOf(), data.runTime as number];
    });

    fetchResponse.dionysus_metadata_workflow_status_statistics.forEach(
      (data) => {
        const dataTime = moment.utc(data.createdTime);
        const dateIndex = dailyIndex(today, dataTime);
        if (dateIndex === undefined || !(data.status in statusSeries)) return;

        statusSeries[data.status][dateIndex] = [dataTime.valueOf(), data.count];
      },
    );

    const modeledResponse: GetMetadataWorkflowStatisticsResponse = {
      categories: {
        status: [
          WorkflowStatus.CREATED,
          WorkflowStatus.STARTED,
          WorkflowStatus.SUCCESS,
          WorkflowStatus.FAILED,
          WorkflowStatus.CANCELLED,
        ],
      },
      series: {
        status: statusSeries,
        timing: {
          queueTime: queueTimeSeries,
          runtime: runtimeSeries,
        },
      },
    };

    return modeledResponse;
  }
}
