import { MediaAssetSearchConfiguration } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";

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
