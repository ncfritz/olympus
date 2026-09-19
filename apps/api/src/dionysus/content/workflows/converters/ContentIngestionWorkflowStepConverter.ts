import { ContentIngestionWorkflowStep } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlContentIngestionWorkflowStep } from "../types/workflow";

export const toDomainObject = (
  input: GraphQlContentIngestionWorkflowStep,
): ContentIngestionWorkflowStep => {
  return {
    id: input.id,
    type: input.type,
    status: input.status,
    progress: input.progress,
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};
