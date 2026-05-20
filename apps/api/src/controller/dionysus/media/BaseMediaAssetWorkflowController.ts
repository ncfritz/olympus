import {
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  MediaAssetWorkflowSubStepType,
  PartialMediaAssetWorkflowStep,
} from "@ncfritz/olympus-model";
import { BadRequestException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { GraphQlMediaAssetWorkflowStep } from "../../../types/dionysus/media/mediaAssetWorkflow";

type GraphQlGetParentMediaAssetWorkflowIdResponse = {
  dionysus_media_asset_workflow_by_pk: {
    id: string;
  };
};

type GraphQlGetParentMediaAssetWorkflowStepIdResponse = {
  dionysus_media_asset_workflow_step_by_pk: {
    id: string;
    type: MediaAssetWorkflowStepType | MediaAssetWorkflowSubStepType;
    status: MediaAssetWorkflowStepStatus;
  };
};

type GraphQlUpdateMediaAssetWorkflowStepResponse = {
  update_dionysus_media_asset_workflow_step_by_pk: GraphQlMediaAssetWorkflowStep;
  update_dionysus_media_asset_workflow_by_pk: {
    id: string;
  };
};

export class BaseMediaAssetWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async verifyWorkflowExists(workflowId: string) {
    const checkParentWorkflowRequest = gql`
      query GetTargetWorkflow($id: uuid!) {
        dionysus_media_asset_workflow_by_pk(id: $id) {
          id
        }
      }
    `;

    const checkParentWorkflowResponse =
      await this.graphQLClient.request<GraphQlGetParentMediaAssetWorkflowIdResponse>(
        checkParentWorkflowRequest,
        { id: workflowId },
      );

    if (!checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk?.id) {
      throw new BadRequestException();
    }
  }

  protected async verifyWorkflowStepExists(
    workflowId: string,
    workflowStepId: string,
    requiredStepType?: MediaAssetWorkflowStepType,
  ) {
    const checkWorkflowStepRequest = gql`
      query GetTargetWorkflowStep($id: uuid!, $workflowId: uuid!) {
        dionysus_media_asset_workflow_step_by_pk(
          id: $id
          workflowId: $workflowId
        ) {
          id
          type
          status
        }
      }
    `;

    const checkWorkflowStepResponse =
      await this.graphQLClient.request<GraphQlGetParentMediaAssetWorkflowStepIdResponse>(
        checkWorkflowStepRequest,
        { id: workflowStepId, workflowId: workflowId },
      );

    if (
      !checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk?.id
    ) {
      throw new BadRequestException();
    }

    if (
      requiredStepType &&
      requiredStepType !==
        checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk?.type
    ) {
      throw new BadRequestException();
    }

    return checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk
      .status;
  }

  protected async updateWorkflowStep(
    workflowId: string,
    workflowStepId: string,
    update: PartialMediaAssetWorkflowStep,
    workflowStatus?: MediaAssetWorkflowStatus,
  ) {
    let workflowUpdateParamsFragment = "";
    let workflowUpdateFragment = "";

    if (workflowStatus) {
      workflowUpdateParamsFragment = gql`
        $workflowStatus: String!
        ${
          workflowStatus === MediaAssetWorkflowStatus.SUCCESS
            ? "$workflowFinishedTime: timestamptz!"
            : ""
        }`;

      workflowUpdateFragment = gql`
        update_dionysus_media_asset_workflow_by_pk(
          pk_columns: {id: $workflowId}
          _set: {
            status: $workflowStatus
            ${
              workflowStatus === MediaAssetWorkflowStatus.SUCCESS
                ? "finishedTime: $workflowFinishedTime,"
                : ""
            }
        }) {
          id
        }`;
    }

    const updateRequest = gql`
      mutation UpdateWorkflow(
        $id: uuid!
        $workflowId: uuid!
        $changes: dionysus_media_asset_workflow_step_set_input = {}
        ${workflowUpdateParamsFragment}
      ) {
        update_dionysus_media_asset_workflow_step_by_pk(
          pk_columns: { id: $id, workflowId: $workflowId }
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
        ${workflowUpdateFragment}
      }
    `;

    const requestParams: Record<string, any> = {
      id: workflowStepId,
      workflowId: workflowId,
      changes: update,
    };

    if (workflowStatus) {
      requestParams["workflowStatus"] = workflowStatus;
    }

    if (workflowStatus === MediaAssetWorkflowStatus.SUCCESS) {
      requestParams["workflowFinishedTime"] = moment().utc().toISOString();
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetWorkflowStepResponse>(
        updateRequest,
        requestParams,
      );

    return toDomainObject(
      updateResponse.update_dionysus_media_asset_workflow_step_by_pk,
    );
  }
}
