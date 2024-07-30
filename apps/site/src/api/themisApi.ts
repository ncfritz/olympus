import axios from "axios";
import type { UpsertReviewYearBasicInfoRequest } from "../pages/api/themis/review/[year]/basicInfo";
import type {
  BaseBasicUserInfo,
  BasicUserInfo,
  CodeStat,
  CRStat,
  ForteSummary,
  JobHistoryEntry,
  JobInfo,
  ReviewRating,
  SimStat,
} from "../types/themis";

const getDataSummary = async (username: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/dataSummary`,
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

const getDataSummaryForYear = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/dataSummary`,
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

const getForteSummary = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/forte`,
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

const getNotes = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/notes`,
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

const getReviewYearBasicInfo = async (year: string) => {
  try {
    const response = await axios.get(`/api/themis/review/${year}/basicInfo`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const upsertReviewYearBasicInfo = async (
  year: string,
  review: UpsertReviewYearBasicInfoRequest,
) => {
  try {
    const response = await axios.put(
      `/api/themis/review/${year}/basicInfo`,
      review,
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

const getRating = async (
  username: string,
  year: string,
  includePrevious: boolean = false,
) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/rating?previous=${includePrevious}`,
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

const getCodeStats = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/code`,
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

const upsertCodeStats = async (
  username: string,
  year: string,
  stats: CodeStat[],
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/code`,
      { stats: stats },
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

const getCrStats = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/cr`,
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

const upsertCrStats = async (
  username: string,
  year: string,
  stats: CRStat[],
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/cr`,
      { stats: stats },
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

const upsertForteSummary = async (
  username: string,
  year: string,
  summary: ForteSummary,
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/forte`,
      { summary: summary },
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

const getSimStats = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/data/${year}/sim`,
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

const upsertNotes = async (username: string, year: string, notes: string) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/notes`,
      { notes: notes },
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

const upsertSimStats = async (
  username: string,
  year: string,
  stats: SimStat[],
) => {
  try {
    const response = await axios.put(
      `/api/themis/user/${username}/data/${year}/sim`,
      { stats: stats },
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

const getReviewRatingsSummary = async (year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/review/${year}/ratingsSummary`,
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

const getReviewUsersSummary = async (year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/review/${year}/usersSummary`,
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

const getReviewCodeStats = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/review/${year}/code`,
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

const getReviewCrStats = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/review/${year}/cr`,
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

const getReviewRating = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/review/${year}/rating`,
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

const getReviewNotes = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/review/${year}/notes`,
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

const getReviewForte = async (username: string, year: string) => {
  try {
    const response = await axios.get(
      `/api/themis/user/${username}/review/${year}/forte`,
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

const getAllReviewCodeStats = async (year: string) => {
  try {
    const response = await axios.get(`/api/themis//review/${year}/data/code`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const getAllReviewCrStats = async (year: string) => {
  try {
    const response = await axios.get(`/api/themis//review/${year}/data/cr`, {
      validateStatus: (status) => {
        return status === 200;
      },
    });

    return response.data;
  } catch (e) {
    throw e;
  }
};

const themisApi = {
  createDataYear: createDataYear,
  createUser: createUser,
  getBasicUserInfo: getBasicUserInfo,
  getCrStats: getCrStats,
  getCodeStats: getCodeStats,
  getSimStats: getSimStats,
  getJobInfo: getJobInfo,
  getDataSummary: getDataSummary,
  getDataSummaryForYear: getDataSummaryForYear,
  getForteSummary: getForteSummary,
  getJobHistory: getJobHistory,
  getNotes: getNotes,
  getRating: getRating,
  getReviewYears: getReviewYears,
  getReviewYearBasicInfo: getReviewYearBasicInfo,
  listDataYears: listDataYears,
  listUsers: listUsers,
  upsertCodeStats: upsertCodeStats,
  upsertCrStats: upsertCrStats,
  upsertForteSummary: upsertForteSummary,
  upsertJobInfo: upsertJobInfo,
  upsertJobHistory: upsertJobHistory,
  upsertNotes: upsertNotes,
  upsertSimStats: upsertSimStats,
  upsertRating: upsertRating,
  upsertReviewYearBasicInfo: upsertReviewYearBasicInfo,
  updateUser: updateUser,
  review: {
    getCodeStats: getReviewCodeStats,
    getCrStats: getReviewCrStats,
    getForte: getReviewForte,
    getNotes: getReviewNotes,
    getRating: getReviewRating,
    getRatingsSummary: getReviewRatingsSummary,
    getUsersSummary: getReviewUsersSummary,
    getAllCodeStats: getAllReviewCodeStats,
    getAllCRStats: getAllReviewCrStats,
  },
};

export default themisApi;
