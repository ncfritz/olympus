import {
  MediaAssetSearchType,
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepType,
  PartialMediaAssetWorkflowStep,
} from "@ncfritz/olympus-model";
import { BadRequestException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { GraphQlMediaAssetWorkflowStep } from "../../../types/dionysus/media/mediaAssetWorkflow";

export type MediaWorkflowDetails = {
  id: string;
  type: MediaAssetSearchType;
  mediaId: number;
};

export type MediaWorkflowStepDetails = {
  id: string;
  type: MediaAssetWorkflowStepType;
  status: string;
  assetType: MediaAssetSearchType;
  mediaId: number;
};

type GraphQlGetParentMediaAssetWorkflowIdResponse = {
  dionysus_media_asset_workflow_by_pk: MediaWorkflowDetails;
};

type GraphQlGetParentMediaAssetWorkflowStepIdResponse = {
  dionysus_media_asset_workflow_step_by_pk: MediaWorkflowStepDetails;
};

type GraphQlUpdateMediaAssetWorkflowStepResponse = {
  update_dionysus_media_asset_workflow_step_by_pk: GraphQlMediaAssetWorkflowStep;
  update_dionysus_media_asset_workflow_by_pk: {
    id: string;
  };
};

export class BaseMediaAssetWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async verifyWorkflowExists(
    workflowId: string,
  ): Promise<MediaWorkflowDetails> {
    const checkParentWorkflowRequest = gql`
      query GetTargetWorkflow($id: uuid!) {
        dionysus_media_asset_workflow_by_pk(id: $id) {
          id
          type
          mediaId
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

    return {
      id: checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk.id,
      type: checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk
        .type,
      mediaId:
        checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk.mediaId,
    };
  }

  protected async verifyWorkflowStepExists(
    workflowId: string,
    workflowStepId: string,
    requiredStepType?: MediaAssetWorkflowStepType,
  ): Promise<MediaWorkflowStepDetails> {
    const checkWorkflowStepRequest = gql`
      query GetTargetWorkflowStep($id: uuid!, $workflowId: uuid!) {
        dionysus_media_asset_workflow_step_by_pk(
          id: $id
          workflowId: $workflowId
        ) {
          id
          type
          status
          assetType
          mediaId
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

    return {
      id: checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk.id,
      type: checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk
        .type,
      status:
        checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk
          .status,
      assetType:
        checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk
          .assetType,
      mediaId:
        checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk
          .mediaId,
    };
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
