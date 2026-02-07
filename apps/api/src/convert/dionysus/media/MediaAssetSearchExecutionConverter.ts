import { MediaAssetSearchExecution } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMediaAssetSearchExecution } from "../../../types/dionysus/media/searchExecution";

export const toDomainObject = (
  input: GraphQlMediaAssetSearchExecution,
): MediaAssetSearchExecution => {
  return {
    id: input.id,
    status: input.status,
    startedTime: moment(input.startedTime),
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    newRecords: input.newRecords,
    duplicateRecords: input.duplicateRecords,
    skippedRecords: input.skippedRecords,
    totalRecords: input.totalRecords,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
