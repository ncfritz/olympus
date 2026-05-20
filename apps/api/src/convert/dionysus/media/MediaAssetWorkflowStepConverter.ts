import {
  MediaAssetWorkflowStep,
  MediaAssetWorkflowSubStep,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlMediaAssetWorkflowGenericStep,
  GraphQlMediaAssetWorkflowStep,
  GraphQlMediaAssetWorkflowSubStep,
} from "../../../types/dionysus/media/mediaAssetWorkflow";

export const toBaseDomainObject = (
  input: GraphQlMediaAssetWorkflowGenericStep,
): Omit<MediaAssetWorkflowSubStep, "type"> => {
  return {
    id: input.id,
    status: input.status,
    progress: input.progress,
    startedTime: input.startedTime ? moment(input.startedTime) : undefined,
    finishedTime: input.finishedTime ? moment(input.finishedTime) : undefined,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toSubStepDomainObject = (
  input: GraphQlMediaAssetWorkflowSubStep,
): MediaAssetWorkflowSubStep => {
  return {
    ...toBaseDomainObject(input),
    type: input.type,
  };
};

export const toDomainObject = (
  input: GraphQlMediaAssetWorkflowStep,
): MediaAssetWorkflowStep => {
  const subSteps: MediaAssetWorkflowSubStep[] = [];

  if (input.subSteps && input.subSteps.length > 0) {
    input.subSteps.forEach((subStep) => {
      subSteps.push(toSubStepDomainObject(subStep));
    });
  }

  return {
    ...toBaseDomainObject(input),
    type: input.type,
    subSteps: subSteps,
  };
};
