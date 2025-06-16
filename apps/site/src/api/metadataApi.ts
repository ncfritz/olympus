import type { FilterValue } from "antd/es/table/interface";
import axios from "axios";

export interface SortOptions {
  field: string;
  order: "asc" | "desc";
}

const fetchCertifications = async (page: number, sort: SortOptions) => {
  try {
    const listCertificationsResponse = await axios.get(
      `/api/v1/metadata/certifications?sort=${sort.order}&sortBy=${sort.field}&pageSize=20&startPage=${page}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listCertificationsResponse;
  } catch (e) {
    throw e;
  }
};

const fetchCountries = async (page: number, sort: SortOptions) => {
  try {
    const listCountriesResponse = await axios.get(
      `/api/v1/metadata/countries?sort=${sort.order}&sortBy=${sort.field}&pageSize=20&startPage=${page}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listCountriesResponse;
  } catch (e) {
    throw e;
  }
};

const fetchGenres = async (page: number, sort: SortOptions) => {
  try {
    const listGenresResponse = await axios.get(
      `/api/v1/metadata/genres?sort=${sort.order}&sortBy=${sort.field}&pageSize=20&startPage=${page}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listGenresResponse;
  } catch (e) {
    throw e;
  }
};

const fetchKeywords = async (page: number, sort: SortOptions) => {
  try {
    const listKeywords = await axios.get(
      `/api/v1/metadata/keywords?sort=${sort.order}&sortBy=${sort.field}&pageSize=20&startPage=${page}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listKeywords;
  } catch (e) {
    throw e;
  }
};

const fetchLanguages = async (page: number, sort: SortOptions) => {
  try {
    const listLanguagesResponse = await axios.get(
      `/api/v1/metadata/languages?sort=${sort.order}&sortBy=${sort.field}&pageSize=20&startPage=${page}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listLanguagesResponse;
  } catch (e) {
    throw e;
  }
};

const fetchMetadataFetchJobs = async (
  page: number,
  pageSize: number,
  sort: SortOptions,
  filters?: Record<string, FilterValue | null>,
) => {
  try {
    const url = `/api/v1/jobs/metadata`;
    const queryString = [
      `sort=${sort.order}`,
      `sortBy=${sort.field}`,
      `pageSize=${pageSize}`,
      `startPage=${page}`,
    ];

    if (filters) {
      queryString.push(
        `filters=${Buffer.from(JSON.stringify(filters)).toString("base64")}`,
      );
    }

    const listMetadataFetchjobsresponse = await axios.get(
      `${url}?${queryString.join("&")}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return listMetadataFetchjobsresponse;
  } catch (e) {
    throw e;
  }
};

const createMetadataFetchJob = async (
  id: string,
  type: string,
  status: string,
  ttl: number,
  jitter: number,
  publish: boolean,
  context: Record<string, string>,
) => {
  try {
    const updateMetadataFetchJobResponse = await axios.post(
      `/api/v1/metadata/fetchJobs`,
      {
        id: id,
        type: type,
        status: status,
        ttl: ttl,
        jitter: jitter,
        publishNotification: publish,
        context: context,
      },
    );

    return updateMetadataFetchJobResponse;
  } catch (e) {
    throw e;
  }
};

const updateMetadataFetchJob = async (
  id: string,
  type: string,
  data: any,
  republish: boolean,
  bypassCache?: boolean,
) => {
  try {
    const updateMetadataFetchJobResponse = await axios.put(
      `/api/v1/metadata/fetchJob/${encodeURIComponent(id)}/${type}`,
      {
        job: data,
        publishNotification: republish,
        bypassCache: bypassCache || false,
      },
    );

    return updateMetadataFetchJobResponse;
  } catch (e) {
    throw e;
  }
};

const deleteMetadataFetchJob = async (id: string, type: string) => {
  try {
    const deleteMetadataFetchJobResponse = await axios.delete(
      `/api/v1/metadata/fetchJob/${encodeURIComponent(id)}/${type}`,
    );

    return deleteMetadataFetchJobResponse;
  } catch (e) {
    throw e;
  }
};

const fetchJobStatistics = async () => {
  try {
    const getStatisticsresponse = await axios.get(
      `/api/v1/job/metadata/stats`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getStatisticsresponse;
  } catch (e) {
    throw e;
  }
};

const metadataApi = {
  createMetadataFetchJob: createMetadataFetchJob,
  deleteMetadataFetchJob: deleteMetadataFetchJob,
  fetchJobStatistics: fetchJobStatistics,
  listCertifications: fetchCertifications,
  listCountries: fetchCountries,
  listGenres: fetchGenres,
  listKeywords: fetchKeywords,
  listLanguages: fetchLanguages,
  listMetadataFetchJobs: fetchMetadataFetchJobs,
  updateMetadataFetchJob: updateMetadataFetchJob,
};

export default metadataApi;
