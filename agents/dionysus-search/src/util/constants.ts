export const IS_PROD = process.env.NODE_ENV === "production";

export const SEARCH_PREFIX = "search";
export const DOWNLOAD_PREFIX = "download";
export const TRIGGER_SUFFIX = "trigger";
export const UPDATE_SUFFIX = "update";

export const MEDIA_TYPE_PREFIX = "jobType";

export const SEARCH_EXECUTION_PREFIX = `${SEARCH_PREFIX}.execution`;
export const SEARCH_FANOUT_PREFIX = `${SEARCH_PREFIX}.fanout`;
export const SEARCH_EXECUTION_TRIGGER_EXCHANGE = `${SEARCH_EXECUTION_PREFIX}.${TRIGGER_SUFFIX}`;
export const SEARCH_FANOUT_TRIGGER_EXCHANGE = `${SEARCH_FANOUT_PREFIX}.${TRIGGER_SUFFIX}`;
export const DOWNLOAD_TRIGGER_EXCHANGE = `${DOWNLOAD_PREFIX}.${TRIGGER_SUFFIX}`;
export const DOWNLOAD_UPDATE_EXCHANGE = `${DOWNLOAD_PREFIX}.${UPDATE_SUFFIX}`;
