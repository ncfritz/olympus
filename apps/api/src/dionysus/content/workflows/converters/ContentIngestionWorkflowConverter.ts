import {
  ContentIngestionWorkflow,
  ContentIngestionWorkflowStep,
} from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQLContentIngestionWorkflow } from "../types/workflow";
import { toDomainObject as toWorkflowStepDomainObject } from "./ContentIngestionWorkflowStepConverter";

export const toDomainObject = (
  input: GraphQLContentIngestionWorkflow,
): ContentIngestionWorkflow => {
  const steps: ContentIngestionWorkflowStep[] = [];

  if (input.steps && input.steps.length > 0) {
    input.steps.forEach((step) => {
      steps.push(toWorkflowStepDomainObject(step));
    });
  }

  return {
    id: input.id,
    source: input.source,
    sourceType: input.sourceType,
    tempLocation: input.tempLocation,
    status: input.status,
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    steps: steps,
    stepCount: input.steps_aggregate
      ? input.steps_aggregate.aggregate.count
      : steps.length,
  };
};
