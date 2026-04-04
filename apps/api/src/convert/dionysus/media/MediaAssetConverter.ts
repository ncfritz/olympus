import { MediaAsset } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlMediaAsset } from "../../../types/dionysus/media/mediaAsset";

export const toDomainObject = (
  input: GraphQlMediaAsset,
): MediaAsset => {
  return {
    type: input.type,
    mediaId: input.mediaId,
    filePath: input.filePath,
    assetSha: input.assetSha,
    originalSizeBytes: input.originalSizeBytes,
    newSizeBytes: input.newSizeBytes,
    durationMs: input.durationMs,
    width: input.width,
    height: input.height,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
