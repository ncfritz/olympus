import {
  batchJobRoute,
  type MetadataJobType,
  publishMessage,
} from "@ncfritz/olympus-messages";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  PartialWorkflowStep,
  WorkflowStatus,
  WorkflowStep,
} from "@ncfritz/olympus-model";
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/WorkflowStepConverter";
import { GraphQlWorkflowStep } from "../types/workflow";
import { METADATA_WORKFLOW_STEP } from "../queries/workflowSteps";

type GraphQlGetParentWorkflowIdResponse = {
  dionysus_metadata_workflow_by_pk: {
    id: string;
  };
};

type GraphQlCreateMetadataWorkflowStepResponse = {
  insert_dionysus_metadata_workflow_step_one: GraphQlWorkflowStep;
};

type GraphQlGetMetadataWorkflowStepResponse = {
  dionysus_metadata_workflow_step_by_pk: GraphQlWorkflowStep;
};

type GraphQLListMetadataWorkflowStepsResponse = {
  dionysus_metadata_workflow_step: GraphQlWorkflowStep[];
};

/** Steps of Dionysus metadata workflows in Hasura, and their batch job triggers. */
@Injectable()
export class MetadataWorkflowStepService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  /**
   * Creates a step (and its batch job) in a workflow and publishes the batch
   * job's trigger. @throws NotFoundException
   */
  async create(
    workflowId: string,
    step: PartialWorkflowStep,
  ): Promise<WorkflowStep> {
    const checkParentWorkflowRequest = gql`
      query GetParentMetadataWorkflow($id: uuid!) {
        dionysus_metadata_workflow_by_pk(id: $id) {
          id
        }
      }
    `;

    const checkParentWorkflowResponse =
      await this.graphQLClient.request<GraphQlGetParentWorkflowIdResponse>(
        checkParentWorkflowRequest,
        { id: workflowId },
      );

    if (!checkParentWorkflowResponse.dionysus_metadata_workflow_by_pk?.id) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    const insertRequest = gql`
      mutation CreateMetadataWorkflowStep(
        $workflowId: uuid!
        $attempt: numeric!
        $workflowStepType: String!
        $batchJobType: String!
        $batchJobStatus: String!
      ) {
        insert_dionysus_metadata_workflow_step_one(
          object: {
            attempt: $attempt
            job: { data: { type: $batchJobType, status: $batchJobStatus } }
            type: $workflowStepType
            workflow_id: $workflowId
          }
        ) {
          ${METADATA_WORKFLOW_STEP}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          workflowStepType: step.type,
          attempt: step.attempt,
          batchJobType: step.jobType,
          batchJobStatus: WorkflowStatus.CREATED,
        },
      );

    const createdWorkflowStep: WorkflowStep = toDomainObject(
      insertResponse.insert_dionysus_metadata_workflow_step_one,
    );
    const createdBatchJob = createdWorkflowStep.job;

    if (!createdBatchJob) {
      throw new InternalServerErrorException();
    }

    // Workflow steps only run metadata job types (never redrive).
    const jobType = createdBatchJob.type as MetadataJobType;
    await publishMessage(this.amqpConnection, batchJobRoute(jobType), {
      jobType,
      jobId: createdBatchJob.id,
      workflowId: workflowId,
      stepId: createdWorkflowStep.id,
      offset: step.offset,
      attempt: step.attempt,
    });

    return createdWorkflowStep;
  }

  /** @throws NotFoundException */
  async describe(workflowId: string, stepId: string): Promise<WorkflowStep> {
    const fetchRequest = gql`
      query DescribeMetadataWorkflowStep($workflowId: uuid!, $stepId: uuid!) {
        dionysus_metadata_workflow_step_by_pk(
          id: $stepId
          workflow_id: $workflowId
        ) {
          ${METADATA_WORKFLOW_STEP}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataWorkflowStepResponse>(
        fetchRequest,
        {
          workflowId: workflowId,
          stepId: stepId,
        },
      );

    if (!fetchResponse.dionysus_metadata_workflow_step_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_metadata_workflow_step_by_pk);
  }

  /** The steps of a workflow. */
  async list(workflowId: string): Promise<WorkflowStep[]> {
    const fetchRequest = gql`
      query ListMetadataWorkflowSteps($workflowId: uuid!) {
        dionysus_metadata_workflow_step(
          where: { workflow_id: { _eq: $workflowId } }
        ) {
          ${METADATA_WORKFLOW_STEP}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQLListMetadataWorkflowStepsResponse>(
        fetchRequest,
        { workflowId: workflowId },
      );
    const fetchedWorkflowSteps: WorkflowStep[] = [];

    fetchResponse.dionysus_metadata_workflow_step.forEach((result) => {
      fetchedWorkflowSteps.push(toDomainObject(result));
    });

    return fetchedWorkflowSteps;
  }
}
