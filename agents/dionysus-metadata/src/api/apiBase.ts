import axios from "axios";
import { logger } from "../util/logger";

export const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

export interface ApiClientOptions {
  url: string;
  method: string;
  data?: any;
  successStatusCodes?: number[];
}

export const executeRequest = async <T>(
  options: ApiClientOptions,
): Promise<T> => {
  try {
    const response = await axios.request<T>({
      url: options.url,
      method: options.method,
      data: options.data ? options.data : undefined,
      withCredentials: true,
      validateStatus: (status) => {
        if (status === 404) {
          return true;
        }

        if (
          options.successStatusCodes &&
          options.successStatusCodes.length > 0
        ) {
          return options.successStatusCodes.includes(status);
        } else {
          return status >= 200 && status < 300;
        }
      },
    });

    return response.data;
  } catch (e) {
    logger.error(`${options.method} request to ${options.url} failed`, e);

    throw e;
  }
};
