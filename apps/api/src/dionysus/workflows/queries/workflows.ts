import { METADATA_WORKFLOW_STEP } from "./workflowSteps";

export const BASE_METADATA_WORKFLOW = `id
  status
  createdTime
  lastUpdatedTime
  startedTime
  finishedTime`;

export const METADATA_WORKFLOW = `
  ${BASE_METADATA_WORKFLOW}
  steps {
    ${METADATA_WORKFLOW_STEP}
  }`;
