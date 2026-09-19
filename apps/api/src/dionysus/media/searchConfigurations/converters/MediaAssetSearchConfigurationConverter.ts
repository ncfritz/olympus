import {
  DecoratedMediaAssetSearchConfiguration,
  MediaAssetSearchConfiguration,
  MediaAssetSearchConfigurationListItem,
  MediaAssetSearchExecution,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  type GraphQlDecoratedMediaAssetSearchConfiguration,
  type GraphQlDecoratedMediaAssetSearchConfigurationListItem,
  GraphQlMediaAssetSearchConfiguration,
} from "../types/searchConfiguration";
import { toMediaWorkflowDecorationDomainObject } from "../../workflows/converters/MediaAssetWorkflowConverter";
import { toDomainObject as toSearchExecutionDomainObject } from "../../searchExecutions/converters/MediaAssetSearchExecutionConverter";

export const toDomainObject = (
  input: GraphQlMediaAssetSearchConfiguration,
): MediaAssetSearchConfiguration => {
  return {
    type: input.assetType,
    mediaId: input.mediaId,
    seriesId: input.seriesId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    enabled: input.enabled,
    status: input.status,
    backoff: input.backoff,
    jitter: input.jitter,
    lastExecutionTime: input.lastExecutionTime
      ? moment(input.lastExecutionTime)
      : undefined,
    nextExecutionTime: moment(input.nextExecutionTime),
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toDecoratedDomainObject = (
  input: GraphQlDecoratedMediaAssetSearchConfiguration,
): DecoratedMediaAssetSearchConfiguration => {
  return {
    ...toDomainObject(input),
    decoration: toMediaWorkflowDecorationDomainObject(input.decoration),
  };
};

export const toDomainObjectListItem = (
  input: GraphQlDecoratedMediaAssetSearchConfigurationListItem,
): MediaAssetSearchConfigurationListItem => {
  const searchExecutions: MediaAssetSearchExecution[] = [];

  if (input.searchExecutions && input.searchExecutions.length > 0) {
    input.searchExecutions.forEach((step) => {
      searchExecutions.push(toSearchExecutionDomainObject(step));
    });
  }

  return {
    ...toDecoratedDomainObject(input),
    executions: searchExecutions,
  };
};
