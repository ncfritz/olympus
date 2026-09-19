import { BatchJob } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlBatchJob } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlBatchJob): BatchJob => {
  return {
    id: input.id,
    type: input.type,
    status: input.status,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    totalRecords: input.totalRecords,
    processedRecords: input.processedRecords,
    duplicateRecords: input.duplicateRecords,
    noOpRecords: input.noOpRecords,
    newRecords: input.newRecords,
    expiredRecords: input.expiredRecords,
    skippedRecords: input.skippedRecords,
    maxRecordsToProcess: input.maxRecordsToProcess || undefined,
  };
};
