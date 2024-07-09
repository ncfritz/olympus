import axios from "axios";
import type {
  BaseBasicUserInfo,
  BasicUserInfo,
  JobHistoryEntry, JobInfo,
  ReviewRating,
} from "../types/themis";

const getReviewYears = async () => {
  try {
    const response = await axios.get(`/api/themis/reviewYears`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const createUser = async (user: BasicUserInfo) => {
  try {
    const response = await axios.post(`/api/themis/users`, user, {
      validateStatus: (status) => {
        return status === 201;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const updateUser = async (username: string, user: BaseBasicUserInfo) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/basicInfo`,
      user,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const listUsers = async () => {
  try {
    const response = await axios.get(`/api/themis/users`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const getBasicUserInfo = async (username: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/basicInfo`,
      {
        validateStatus: (status) => {
          return status === 200 || status === 204;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const listDataYears = async (username: string) => {
  try {
    const response = await axios.get(`/api/themis/user/${username}/dataYears`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const createDataYear = async (username: string, year: string) => {
  try {
    const response = await axios.post(
      `/api/themis/user/${username}/dataYears`,
      { year: year },
      {
        validateStatus: (status) => {
          return status === 201;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const getRating = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/rating`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const upsertRating = async (
  username: string,
  year: string,
  rating: ReviewRating,
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/rating`,
      { rating: rating },
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const getJobHistory = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/jobHistory`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const upsertJobHistory = async (
  username: string,
  year: string,
  entries: JobHistoryEntry[],
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/jobHistory`,
      { entries: entries },
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const getJobInfo = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/jobInfo`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const upsertJobInfo = async (
  username: string,
  year: string,
  jobInfo: JobInfo,
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/jobInfo`,
      { jobInfo: jobInfo },
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return response.data;
  } catch (e) {
    throw e;
  }
};

const themisApi = {
  createDataYear: createDataYear,
  createUser: createUser,
  getBasicUserInfo: getBasicUserInfo,
  getJobInfo: getJobInfo,
  getJobHistory: getJobHistory,
  getRating: getRating,
  getReviewYears: getReviewYears,
  listDataYears: listDataYears,
  listUsers: listUsers,
  upsertJobInfo: upsertJobInfo,
  upsertJobHistory: upsertJobHistory,
  upsertRating: upsertRating,
  updateUser: updateUser,
};

export default themisApi;
