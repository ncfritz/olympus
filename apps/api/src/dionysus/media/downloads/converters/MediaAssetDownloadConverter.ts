import {
  DecoratedMediaAssetDownload,
  MediaAssetDownload,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlDecoratedMediaAssetDownload,
  GraphQlMediaAssetDownload,
} from "../types/mediaDownload";
import { toMediaWorkflowDecorationDomainObject } from "../../workflows/converters/MediaAssetWorkflowConverter";

export const toDomainObject = (
  input: GraphQlMediaAssetDownload,
): MediaAssetDownload => {
  return {
    id: input.id,
    nzbId: input.nzbId,
    type: input.assetType,
    mediaId: input.mediaId,
    workflowId: input.workflowId,
    searchResultId: input.searchResultId,
    status: input.status,
    progress: input.progress,
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toDecoratedDomainObject = (
  input: GraphQlDecoratedMediaAssetDownload,
): DecoratedMediaAssetDownload => {
  return {
    ...toDomainObject(input),
    decoration: toMediaWorkflowDecorationDomainObject(input.decoration),
  };
};
