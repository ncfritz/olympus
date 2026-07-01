import {
  DecoratedMediaAssetWorkflowStep,
  MediaAssetWorkflowStep,
  MediaAssetWorkflowSubStep,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlDecoratedMediaAssetWorkflowStep,
  GraphQlMediaAssetWorkflowGenericStep,
  GraphQlMediaAssetWorkflowStep,
  GraphQlMediaAssetWorkflowSubStep,
} from "../../../types/dionysus/media/mediaAssetWorkflow";
import { toMediaWorkflowDecorationDomainObject } from "./MediaAssetWorkflowConverter";

export const toBaseDomainObject = (
  input: GraphQlMediaAssetWorkflowGenericStep,
): Omit<MediaAssetWorkflowSubStep, "type"> => {
  return {
    id: input.id,
    assetType: input.assetType,
    mediaId: input.mediaId,
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

export const toDecoratedDomainObject = (
  input: GraphQlDecoratedMediaAssetWorkflowStep,
): DecoratedMediaAssetWorkflowStep => {
  return {
    ...toDomainObject(input),
    decoration: toMediaWorkflowDecorationDomainObject(input.decoration),
  };
};
