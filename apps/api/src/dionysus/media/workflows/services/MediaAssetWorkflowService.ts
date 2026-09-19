import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  ApproveMediaAssetTranscodeConfigurationRequest,
  BaseMediaAssetWorkflowStep,
  BaseMediaAssetWorkflowSubStep,
  DecoratedMediaAssetWorkflow,
  DecoratedMediaAssetWorkflowStep,
  FilterDefinition,
  FilterType,
  MediaAssetSearchType,
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  MediaAssetWorkflowSubStep,
  MediaDownloadStatus,
  PartialMediaAssetWorkflow,
  PartialMediaAssetWorkflowStep,
  SearchResultStatus,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { toDecoratedDomainObject } from "../converters/MediaAssetWorkflowConverter";
import {
  toDecoratedDomainObject as toDecoratedStepDomainObject,
  toSubStepDomainObject,
} from "../converters/MediaAssetWorkflowStepConverter";
import {
  BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP,
  BASE_MEDIA_ASSET_WORKFLOW_STEP,
  DECORATED_MEDIA_ASSET_WORKFLOW,
} from "../queries/mediaAssetWorkflow";
import {
  GraphQlDecoratedMediaAssetWorkflow,
  GraphQlDecoratedMediaAssetWorkflowStep,
  GraphQlMediaAssetWorkflowSubStep,
} from "../types/mediaAssetWorkflow";
import { MediaAssetSearchResultService } from "../../searchResults/services/MediaAssetSearchResultService";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { logger } from "../../../../utils/logger";

type MediaWorkflowDetails = {
  id: string;
  type: MediaAssetSearchType;
  mediaId: number;
};

type MediaWorkflowStepDetails = {
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

type GraphQlListMediaAssetWorkflowsResponse = {
  dionysus_media_asset_workflow: GraphQlDecoratedMediaAssetWorkflow[];
  dionysus_media_asset_workflow_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlGetMediaAssetWorkflowResponse = {
  dionysus_media_asset_workflow_by_pk: GraphQlDecoratedMediaAssetWorkflow;
};

type GraphQlCreateMediaAssetWorkflowResponse = {
  insert_dionysus_media_asset_download_one: {
    status: string;
  };
  insert_dionysus_media_asset_workflow_one: GraphQlDecoratedMediaAssetWorkflow;
  update_dionysus_media_asset_search_result_by_pk: {
    status: string;
  };
};

type GraphQlUpdateChildMediaAssetWorkflowResponse = {
  update_dionysus_media_asset_workflow_by_pk: GraphQlDecoratedMediaAssetWorkflow | null;
};

type GraphQlGetMediaAssetWorkflowStepResponse = {
  dionysus_media_asset_workflow_step_by_pk: GraphQlDecoratedMediaAssetWorkflowStep;
};

type GraphQlCreateMediaAssetWorkflowStepResponse = {
  insert_dionysus_media_asset_workflow_step_one: GraphQlDecoratedMediaAssetWorkflowStep;
};

type GraphQlCreateMediaAssetWorkflowSubStepResponse = {
  insert_dionysus_media_asset_workflow_step_one: GraphQlMediaAssetWorkflowSubStep;
};

type GraphQlListMediaAssetTranscodesResponse = {
  dionysus_media_asset_workflow_step: GraphQlDecoratedMediaAssetWorkflowStep[];
  dionysus_media_asset_workflow_step_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** A page of workflows plus the total matching count. */
export type MediaAssetWorkflowList = {
  workflows: DecoratedMediaAssetWorkflow[];
  count: number;
};

/** A page of transcode steps plus the total matching count. */
export type MediaAssetTranscodeList = {
  steps: DecoratedMediaAssetWorkflowStep[];
  count: number;
};

const STEP_TYPE_FILTER: FilterDefinition = {
  type: FilterType.EQUALS,
  name: "type",
  value: MediaAssetWorkflowStepType.TRANSCODE,
};

/** Media asset workflows and their steps in Hasura, and the jobs they start. */
@Injectable()
export class MediaAssetWorkflowService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
    private readonly searchResults: MediaAssetSearchResultService,
  ) {}

  async list(
    pagination: PaginationParams,
    userFilters: FilterDefinition | undefined,
  ): Promise<MediaAssetWorkflowList> {
    const whereExpression = buildFilterExpression(userFilters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMediaAssetWorkflows {
        dionysus_media_asset_workflow(${[
          paginationExpression,
          whereExpression,
        ].join(", ")}) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
        dionysus_media_asset_workflow_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetWorkflowsResponse>(
        fetchRequest,
      );
    const fetchedWorkflows: DecoratedMediaAssetWorkflow[] = [];

    fetchResponse.dionysus_media_asset_workflow.forEach((result) => {
      fetchedWorkflows.push(toDecoratedDomainObject(result));
    });

    return {
      workflows: fetchedWorkflows,
      count:
        fetchResponse.dionysus_media_asset_workflow_aggregate.aggregate.count,
    };
  }

  /** @throws NotFoundException */
  async describe(workflowId: string): Promise<DecoratedMediaAssetWorkflow> {
    const fetchRequest = gql`
      query DescribeMediaAssetWorkflow(
        $workflowId: uuid!
      ) {
        dionysus_media_asset_workflow_by_pk(
          id: $workflowId
        ) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetWorkflowResponse>(
        fetchRequest,
        {
          workflowId: workflowId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_workflow_by_pk) {
      throw new NotFoundException();
    }

    return toDecoratedDomainObject(
      fetchResponse.dionysus_media_asset_workflow_by_pk,
    );
  }

  /**
   * Starts a workflow that downloads a search result: records the pending
   * download and workflow, marks the result as requested and enqueues the
   * download. @throws NotFoundException
   */
  async create(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
  ): Promise<DecoratedMediaAssetWorkflow> {
    await this.searchResults.verifyExists(mediaType, mediaId, resultId);

    const workflowId = uuidv4();

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflow(
        $workflowId: uuid!
        $searchResultId: String!
        $assetType: String!
        $mediaId: numeric!
        $workflowStatus: String!
        $searchResultStatus: String!
        $startedTime: timestamptz!
        $downloadStatus: String!
        $downloadProgress: numeric!
      ) {
        insert_dionysus_media_asset_download_one(
          object: {
            status: $downloadStatus
            searchResultId: $searchResultId
            progress: $downloadProgress
            workflowId: $workflowId
            assetType: $assetType
            mediaId: $mediaId
          }
        ) {
          status
        }
        insert_dionysus_media_asset_workflow_one(object: {
          id: $workflowId
          type: $assetType 
          mediaId: $mediaId 
          status: $workflowStatus 
          startedTime: $startedTime
        }) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
        update_dionysus_media_asset_search_result_by_pk(
          pk_columns: {
            assetType: $assetType 
            id: $searchResultId
            mediaId: $mediaId
          }, _set: {
            status: $searchResultStatus
          }
        ) {
            status
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          assetType: mediaType,
          mediaId: mediaId,
          workflowStatus: MediaAssetWorkflowStatus.QUEUED,
          startedTime: moment.utc().toISOString(),
          downloadStatus: MediaDownloadStatus.PENDING,
          downloadProgress: 0,
          searchResultId: resultId,
          searchResultStatus: SearchResultStatus.DOWNLOAD_REQUESTED,
        },
      );

    const createdWorkflow: DecoratedMediaAssetWorkflow =
      toDecoratedDomainObject(
        insertResponse.insert_dionysus_media_asset_workflow_one,
      );

    await this.amqpConnection.publish(
      "download.trigger",
      "download.start",
      {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: resultId,
        workflowId: createdWorkflow.id,
        downloadId: createdWorkflow.download.id,
        nzbId: resultId,
      },
      {
        persistent: true,
        headers: {
          "x-delay": 10000,
        },
      },
    );

    return createdWorkflow;
  }

  /** Applies `changes` to a workflow. @throws NotFoundException */
  async update(
    workflowId: string,
    changes: PartialMediaAssetWorkflow,
  ): Promise<DecoratedMediaAssetWorkflow> {
    const updateRequest = gql`
      mutation UpdateMediaAssetWorkflow(
        $workflowId: uuid!
        $changes: dionysus_media_asset_workflow_set_input = {}
      ) {
        update_dionysus_media_asset_workflow_by_pk(
          pk_columns: { id: $workflowId }
          _set: $changes
        ) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetWorkflowResponse>(
        updateRequest,
        {
          workflowId: workflowId,
          changes: changes,
        },
      );

    if (!updateResponse.update_dionysus_media_asset_workflow_by_pk) {
      throw new NotFoundException();
    }

    return toDecoratedDomainObject(
      updateResponse.update_dionysus_media_asset_workflow_by_pk,
    );
  }

  /**
   * Soft-deletes a workflow and enqueues its cleanup, or with `hardDelete`
   * removes it with its steps and downloads. @throws NotFoundException
   */
  async delete(workflowId: string, hardDelete: boolean): Promise<void> {
    if (hardDelete) {
      const deleteRequest = gql`
        mutation HardDeleteMediaAssetWorkflow($workflowId: uuid!) {
          delete_dionysus_media_asset_workflow_step(
            where: { workflowId: { _eq: $workflowId } }
          ) {
            affected_rows
          }
          delete_dionysus_media_asset_download(
            where: { workflowId: { _eq: $workflowId } }
          ) {
            affected_rows
          }
          delete_dionysus_media_asset_workflow_by_pk(id: $workflowId) {
            id
          }
        }
      `;

      const deleteResponse = await this.graphQLClient.request<{
        delete_dionysus_media_asset_workflow_by_pk: { id: string } | null;
      }>(deleteRequest, {
        workflowId: workflowId,
      });

      if (!deleteResponse.delete_dionysus_media_asset_workflow_by_pk) {
        throw new NotFoundException();
      }
    } else {
      const deleteRequest = gql`
        mutation SoftDeleteMediaAssetWorkflow(
          $workflowId: uuid!
          $deletionTime: timestamptz!
        ) {
          update_dionysus_media_asset_workflow_by_pk(
            pk_columns: { id: $workflowId }
            _set: { deleted: true, deleted_at: $deletionTime }
          ) {
            id
          }
        }
      `;
      const now = moment.utc();

      const deleteResponse = await this.graphQLClient.request<{
        update_dionysus_media_asset_workflow_by_pk: { id: string } | null;
      }>(deleteRequest, {
        workflowId: workflowId,
        deletionTime: now.toISOString(),
      });

      if (!deleteResponse.update_dionysus_media_asset_workflow_by_pk) {
        throw new NotFoundException();
      }

      await this.amqpConnection.publish(
        "media.trigger",
        "jobType.deleteWorkflow",
        {
          workflowId: workflowId,
        },
      );
    }
  }

  /** @throws NotFoundException */
  async describeStep(
    workflowId: string,
    workflowStepId: string,
  ): Promise<DecoratedMediaAssetWorkflowStep> {
    const fetchRequest = gql`
      query DescribeMediaAssetWorkflowStep(
        $workflowId: uuid!
        $workflowStepId: uuid!
      ) {
        dionysus_media_asset_workflow_step_by_pk(
          workflowId: $workflowId
          id: $workflowStepId
        ) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetWorkflowStepResponse>(
        fetchRequest,
        {
          workflowId: workflowId,
          workflowStepId: workflowStepId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_workflow_step_by_pk) {
      throw new NotFoundException();
    }

    return toDecoratedStepDomainObject(
      fetchResponse.dionysus_media_asset_workflow_step_by_pk,
    );
  }

  /** Adds a running step to a workflow. @throws NotFoundException */
  async createStep(
    workflowId: string,
    step: BaseMediaAssetWorkflowStep,
  ): Promise<DecoratedMediaAssetWorkflowStep> {
    const workflowDetails = await this.verifyWorkflowExists(workflowId);

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflowStep(
        $workflowId: uuid!
        $assetType: String!
        $mediaId: numeric!
        $workflowStepType: String!
        $workflowStepStatus: String!
        $progress: numeric!
        $startedTime: timestamptz!
      ) {
        insert_dionysus_media_asset_workflow_step_one(
          object: {
            workflowId: $workflowId
            assetType: $assetType
            mediaId: $mediaId
            type: $workflowStepType
            status: $workflowStepStatus
            progress: $progress
            startedTime: $startedTime
          }
        ) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          assetType: workflowDetails.type,
          mediaId: workflowDetails.mediaId,
          workflowStepType: step.type,
          workflowStepStatus: MediaAssetWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    return toDecoratedStepDomainObject(
      insertResponse.insert_dionysus_media_asset_workflow_step_one,
    );
  }

  /** Adds a running sub step to a workflow step. @throws NotFoundException */
  async createSubStep(
    workflowId: string,
    workflowStepId: string,
    subStep: BaseMediaAssetWorkflowSubStep,
  ): Promise<MediaAssetWorkflowSubStep> {
    const stepDetails = await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
    );

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflowSubStep(
        $workflowId: uuid!
        $assetType: String!
        $mediaId: numeric!
        $workflowStepId: uuid!
        $workflowStepType: String!
        $workflowStepStatus: String!
        $progress: numeric!
        $startedTime: timestamptz!
      ) {
        insert_dionysus_media_asset_workflow_step_one(
          object: {
            workflowId: $workflowId
            assetType: $assetType
            mediaId: $mediaId
            type: $workflowStepType
            status: $workflowStepStatus
            progress: $progress
            startedTime: $startedTime
            parent_step_id: $workflowStepId
          }
        ) {
          ${BASE_MEDIA_ASSET_WORKFLOW_STEP}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowSubStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          assetType: stepDetails.assetType,
          mediaId: stepDetails.mediaId,
          workflowStepId: workflowStepId,
          workflowStepType: subStep.type,
          workflowStepStatus: MediaAssetWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    return toSubStepDomainObject(
      insertResponse.insert_dionysus_media_asset_workflow_step_one,
    );
  }

  /**
   * Applies `step` to a workflow step, moving the workflow's status to
   * match (to `success` only with `updateWorkflowStatus`). Progress never
   * goes backwards. @throws NotFoundException
   */
  async updateStep(
    workflowId: string,
    workflowStepId: string,
    step: PartialMediaAssetWorkflowStep,
    updateWorkflowStatus: boolean,
  ): Promise<DecoratedMediaAssetWorkflowStep> {
    logger.info(
      `Updating workflow step ${workflowStepId} to status ${step.status} - workflow update: ${updateWorkflowStatus}`,
    );

    await this.verifyWorkflowExists(workflowId);
    const stepDetails = await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
    );

    let workflowStatus: MediaAssetWorkflowStatus | undefined = undefined;

    if (step.status === MediaAssetWorkflowStepStatus.PENDING) {
      workflowStatus = MediaAssetWorkflowStatus.PENDING_INPUT;
    } else if (step.status === MediaAssetWorkflowStepStatus.FAILED) {
      workflowStatus = MediaAssetWorkflowStatus.FAILED;
    } else if (
      step.status === MediaAssetWorkflowStepStatus.SKIPPED ||
      step.status === MediaAssetWorkflowStepStatus.RUNNING
    ) {
      workflowStatus = MediaAssetWorkflowStatus.RUNNING;
    }

    logger.debug(
      `UpdateWorkflowStatus: ${updateWorkflowStatus} - currentStatus: ${workflowStatus}`,
    );

    if (
      updateWorkflowStatus &&
      step.status === MediaAssetWorkflowStepStatus.SUCCESS
    ) {
      workflowStatus = MediaAssetWorkflowStatus.SUCCESS;
    }

    if (step.progress !== undefined && step.progress < stepDetails.progress) {
      logger.debug(
        `Progress ${step.progress} for step ${workflowStepId} is behind the stored ${stepDetails.progress}; keeping the stored value`,
      );

      step.progress = stepDetails.progress;
    }

    return this.updateWorkflowStep(
      workflowId,
      workflowStepId,
      step,
      workflowStatus,
    );
  }

  /**
   * Completes a transcode configuration step and enqueues the transcode
   * configuration job. @throws NotFoundException, BadRequestException
   */
  async approveTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
    request: ApproveMediaAssetTranscodeConfigurationRequest,
  ): Promise<DecoratedMediaAssetWorkflowStep> {
    await this.verifyWorkflowExists(workflowId);
    await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
      MediaAssetWorkflowStepType.CONFIGURE_TRANSCODE,
    );
    const updatedWorkflowStep = await this.updateWorkflowStep(
      workflowId,
      workflowStepId,
      {
        status: MediaAssetWorkflowStepStatus.RUNNING,
        progress: 100,
        finishedTime: moment().utc(),
      },
    );

    await this.amqpConnection.publish(
      "media.trigger",
      "jobType.transcodeConfiguration",
      {
        workflowId: workflowId,
        configurationStepId: workflowStepId,
        videoStreamIndex: request.videoTrackIndex,
        audioStreamIndex: request.audioTrackIndex,
        subtitleStreamIndex: request.subtitleTrackIndex,
        mediaExtension: request.originalAssetExtension,
        transcodeVerificationRequired: request.verificationRequired,
      },
      {
        persistent: true,
      },
    );

    return updatedWorkflowStep;
  }

  /**
   * Completes (or leaves skipped) a transcode verification step and
   * enqueues the transcode job. @throws NotFoundException, BadRequestException
   */
  async verifyTranscodeConfiguration(
    workflowId: string,
    workflowStepId: string,
  ): Promise<DecoratedMediaAssetWorkflowStep> {
    await this.verifyWorkflowExists(workflowId);
    const stepDetails = await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
      MediaAssetWorkflowStepType.VERIFY_TRANSCODE,
    );

    const newStatus =
      stepDetails.status === MediaAssetWorkflowStepStatus.SKIPPED
        ? MediaAssetWorkflowStepStatus.SKIPPED
        : MediaAssetWorkflowStepStatus.SUCCESS;

    const updatedWorkflowStep = await this.updateWorkflowStep(
      workflowId,
      workflowStepId,
      {
        status: newStatus,
        progress: 100,
        finishedTime: moment().utc(),
      },
    );

    logger.debug(
      `Workflow step ${workflowStepId} updated to status ${newStatus}`,
    );
    await this.amqpConnection.publish(
      "media.trigger",
      "jobType.transcode",
      {
        workflowId: workflowId,
        configurationStepId: workflowStepId,
      },
      {
        persistent: true,
      },
    );

    return updatedWorkflowStep;
  }

  /** Transcode steps across workflows, narrowed by `userFilters`. */
  async listTranscodes(
    pagination: PaginationParams,
    userFilters: FilterDefinition | undefined,
  ): Promise<MediaAssetTranscodeList> {
    let queryFilters = STEP_TYPE_FILTER;

    if (userFilters) {
      queryFilters = {
        type: FilterType.AND,
        name: "_and",
        value: [STEP_TYPE_FILTER, userFilters],
      };
    }

    const whereExpression = buildFilterExpression(queryFilters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMediaAssetTranscodes {
        dionysus_media_asset_workflow_step(${[
          paginationExpression,
          whereExpression,
        ].join(", ")}) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
        }
        dionysus_media_asset_workflow_step_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetTranscodesResponse>(
        fetchRequest,
      );
    const fetchedTranscodces: DecoratedMediaAssetWorkflowStep[] = [];

    fetchResponse.dionysus_media_asset_workflow_step.forEach(
      (configuration) => {
        fetchedTranscodces.push(toDecoratedStepDomainObject(configuration));
      },
    );

    return {
      steps: fetchedTranscodces,
      count:
        fetchResponse.dionysus_media_asset_workflow_step_aggregate.aggregate
          .count,
    };
  }

  private async verifyWorkflowExists(
    workflowId: string,
  ): Promise<MediaWorkflowDetails> {
    const checkParentWorkflowRequest = gql`
      query GetParentMediaAssetWorkflow($id: uuid!) {
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
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    return {
      id: checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk.id,
      type: checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk
        .type,
      mediaId:
        checkParentWorkflowResponse.dionysus_media_asset_workflow_by_pk.mediaId,
    };
  }

  private async verifyWorkflowStepExists(
    workflowId: string,
    workflowStepId: string,
    requiredStepType?: MediaAssetWorkflowStepType,
  ): Promise<MediaWorkflowStepDetails> {
    const checkWorkflowStepRequest = gql`
      query GetParentMediaAssetWorkflowStep($id: uuid!, $workflowId: uuid!) {
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
      throw new NotFoundException(
        `Workflow step ${workflowId}/${workflowStepId} not found`,
      );
    }

    if (
      requiredStepType &&
      requiredStepType !==
        checkWorkflowStepResponse.dionysus_media_asset_workflow_step_by_pk?.type
    ) {
      throw new BadRequestException(
        `Workflow step ${workflowStepId} is not a ${requiredStepType} step`,
      );
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

  private async updateWorkflowStep(
    workflowId: string,
    workflowStepId: string,
    update: PartialMediaAssetWorkflowStep,
    workflowStatus?: MediaAssetWorkflowStatus,
  ): Promise<DecoratedMediaAssetWorkflowStep> {
    let workflowUpdateParamsFragment = "";
    let workflowUpdateFragment = "";

    const requestParams: Record<string, unknown> = {
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

      workflowUpdateParamsFragment = `
        $workflowStatus: String!
        ${
          workflowStatus === MediaAssetWorkflowStatus.SUCCESS
            ? "$workflowFinishedTime: timestamptz!"
            : ""
        }`;

      workflowUpdateFragment = `
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
      mutation UpdateMediaAssetWorkflowStep(
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

    return toDecoratedStepDomainObject(
      updateResponse.update_dionysus_media_asset_workflow_step_by_pk,
    );
  }
}
