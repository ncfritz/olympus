import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
} from "@ncfritz/olympus-model";
import { NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/content/workflow/ContentIngestionWorkflowConverter";
import { GraphQLContentIngestionWorkflow } from "../../../../types/dionysus/content/workflow";

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

export class BaseContentIngestionWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async createContentIngestionWorkflow(
    source: string,
    sourceType: ContentIngestionWorkflowAssetLocation,
  ) {
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

  protected async verifyWorkflowExists(workflowId: string) {
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

  protected async verifyWorkflowStepExists(
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
