import { MediaAssetDownload } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMediaAssetDownload } from "../../../types/dionysus/media/mediaDownload";

export const toDomainObject = (
  input: GraphQlMediaAssetDownload,
): MediaAssetDownload => {
  return {
    id: input.id,
    nzbId: input.nzbId,
    workflowId: input.workflowId,
    status: input.status,
    progress: input.progress,
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
