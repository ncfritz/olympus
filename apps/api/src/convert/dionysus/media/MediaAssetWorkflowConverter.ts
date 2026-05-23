import {
  MediaAssetWorkflow,
  MediaAssetWorkflowDecoration,
  MediaAssetWorkflowListItem,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlMediaAssetWorkflow,
  GraphQlMediaAssetWorkflowDecoration,
  GraphQlMediaAssetWorkflowListItem,
} from "../../../types/dionysus/media/mediaAssetWorkflow";
import { toDomainObject as toDownloadDomainObject } from "./MediaAssetDownloadConverter";
import { toDomainObject as toWorkflowStepDomainObject } from "./MediaAssetWorkflowStepConverter";

export const toDomainObject = (
  input: GraphQlMediaAssetWorkflow,
): MediaAssetWorkflow => {
  console.log(input);
  const steps: MediaAssetWorkflowStep[] = [];

  if (input.steps && input.steps.length > 0) {
    input.steps.forEach((step) => {
      steps.push(toWorkflowStepDomainObject(step));
    });
  }

  return {
    id: input.id,
    type: input.type,
    mediaId: input.mediaId,
    status: input.status,
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    steps: steps,
    download: toDownloadDomainObject(input.download),
    // Transcode
  };
};

export const toMediaWorkflowDecorationDomainObject = (
  input: GraphQlMediaAssetWorkflowDecoration,
): MediaAssetWorkflowDecoration => {
  return {
    name: input.name,
    seriesName: input.seriesName,
    seasonNumber: input.season,
    episodeNumber: input.episode,
    posterPath: input.posterPath,
  };
};

export const toMediaAssetWorkflowListItemDomainObject = (
  input: GraphQlMediaAssetWorkflowListItem,
): MediaAssetWorkflowListItem => {
  return {
    ...toDomainObject(input),
    decoration: toMediaWorkflowDecorationDomainObject(input.decoration),
  };
};
