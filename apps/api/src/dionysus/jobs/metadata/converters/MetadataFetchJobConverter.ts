import { MetadataFetchJob } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";

export const toDomainObject = (
  input: GraphQlMetadataFetchJob,
): MetadataFetchJob => {
  return {
    id: input.id,
    type: input.type,
    status: input.status,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    lastFetchedTime: input.lastFetchedTime
      ? moment(input.lastFetchedTime)
      : undefined,
    ttl: input.ttl,
    jitter: input.jitter,
    context: input.context
      ? JSON.parse(Buffer.from(input.context, "base64").toString("utf-8"))
      : {},
  };
};
