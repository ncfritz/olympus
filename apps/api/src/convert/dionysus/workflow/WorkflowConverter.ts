import { Workflow, WorkflowStep } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQLWorkflow } from "../../../types/workflow";
import { toDomainObject as toWorkflowStepDomainObject } from "./WorkflowStepConverter";

export const toDomainObject = (input: GraphQLWorkflow): Workflow => {
  const steps: WorkflowStep[] = [];

  if (input.steps && input.steps.length > 0) {
    input.steps.forEach((step) => {
      steps.push(toWorkflowStepDomainObject(step));
    });
  }

  return {
    id: input.id,
    status: input.status,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    steps: steps,
    stepCount: input.steps_aggregate
      ? input.steps_aggregate.aggregate.count
      : steps.length,
  };
};
