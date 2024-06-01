import axios from "axios";

const createBatchJob = async (
  type: string,
  publishNotification: boolean,
  skipRecords = 0,
) => {
  try {
    const createBatchJobResponse = await axios.post(`/api/v1/jobs/batch`, {
      type: type,
      publishNotification: publishNotification,
      offset: skipRecords,
    });

    return createBatchJobResponse;
  } catch (e) {
    throw e;
  }
};

const batchJobApi = {
  createBatchJob: createBatchJob,
};

export default batchJobApi;
