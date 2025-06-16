import { WorkflowStep } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlWorkflowStep } from "../../../types/workflow";
import { toDomainObject as toBatchJobDomainObject } from "../../batch/BatchJobConverter";

export const toDomainObject = (input: GraphQlWorkflowStep): WorkflowStep => {
  return {
    id: input.id,
    type: input.type,
    attempt: input.attempt,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    job: input.job ? toBatchJobDomainObject(input.job) : undefined,
  }
}