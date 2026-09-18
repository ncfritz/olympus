import {
  MediaAssetSearchType,
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepType,
  PartialMediaAssetWorkflowStep,
} from "@ncfritz/olympus-model";
import { BadRequestException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflowStep } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { logger } from "../../../utils/logger";

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
  progress: number;
};

type GraphQlGetParentMediaAssetWorkflowIdResponse = {
  dionysus_media_asset_workflow_by_pk: MediaWorkflowDetails;
};

type GraphQlGetParentMediaAssetWorkflowStepIdResponse = {
  dionysus_media_asset_workflow_step_by_pk: MediaWorkflowStepDetails;
};

type GraphQlUpdateMediaAssetWorkflowStepResponse = {
  update_dionysus_media_asset_workflow_step_by_pk: GraphQlDecoratedMediaAssetWorkflowStep;
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
          progress
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
      progress:
        checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk
          .progress,
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

    const requestParams: Record<string, any> = {
      id: workflowStepId,
      workflowId: workflowId,
      changes: update,
    };

    if (workflowStatus) {
      logger.info(
        `Updating workflow ${workflowId} to status ${workflowStatus}`,
      );

      requestParams["workflowStatus"] = workflowStatus;

      if (workflowStatus === MediaAssetWorkflowStatus.SUCCESS) {
        requestParams["workflowFinishedTime"] = moment().utc().toISOString();
      }

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
      mutation UpdateWorkflowStep(
        $id: uuid!
        $workflowId: uuid!
        $changes: dionysus_media_asset_workflow_step_set_input = {}
        ${workflowUpdateParamsFragment}
      ) {
        update_dionysus_media_asset_workflow_step_by_pk(
          pk_columns: { id: $id, workflowId: $workflowId }
          _set: $changes
        ) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
        }
        ${workflowUpdateFragment}
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetWorkflowStepResponse>(
        updateRequest,
        requestParams,
      );

    return toDecoratedDomainObject(
      updateResponse.update_dionysus_media_asset_workflow_step_by_pk,
    );
  }
}
