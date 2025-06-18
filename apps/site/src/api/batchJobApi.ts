import axios from "axios";

const createBatchJob = async (
  type: string,
  publishNotification: boolean,
  skipRecords = 0,
  maxRecordsToProcess?: number,
) => {
  try {
    const createBatchJobResponse = await axios.post(`/api/v1/jobs/batch`, {
      type: type,
      publishNotification: publishNotification,
      offset: skipRecords,
      maxRecordsToProcess: maxRecordsToProcess,
    });

    return createBatchJobResponse;
  } catch (e) {
    throw e;
  }
};

const deleteBatchJob = async (id: string) => {
  try {
    const deleteBatchJobResponse = await axios.delete(
      `/api/v1/job/batch/${id}`,
    );

    return deleteBatchJobResponse;
  } catch (e) {
    throw e;
  }
};

const createBatchRedriveJob = async (
  metadataType: string,
  status: string,
  targetStatus: string,
  publishNotification: boolean,
) => {
  try {
    const createBatchRedriveJobResponse = await axios.post(
      `/api/v1/jobs/batch/redrive`,
      {
        metadataType: metadataType,
        status: status,
        targetStatus: targetStatus,
        publishNotification: publishNotification,
      },
    );

    return createBatchRedriveJobResponse;
  } catch (e) {
    throw e;
  }
};

const updateBatchJob = async (id: string, job: Record<string, string>) => {
  try {
    const updateBatchRedriveJobResponse = await axios.put(
      `/api/v1/job/batch/${id}`,
      job,
    );

    return updateBatchRedriveJobResponse;
  } catch (e) {
    throw e;
  }
};

const batchJobApi = {
  createBatchJob: createBatchJob,
  deleteBatchJob: deleteBatchJob,
  createBatchRedriveJob: createBatchRedriveJob,
  updateBatchJob: updateBatchJob,
};

export default batchJobApi;
