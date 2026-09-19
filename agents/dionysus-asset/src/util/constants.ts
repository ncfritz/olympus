export const IS_PROD = process.env.NODE_ENV === "production";

export const UPDATE_SUFFIX = "update";

export const ASSETS_JOB_PREFIX = "content";
export const DOWNLOAD_PREFIX = "download";
export const MEDIA_JOB_PREFIX = "media";
export const JOB_TYPE_PREFIX = "jobType";
export const TRIGGER_SUFFIX = "trigger";

export const ASSETS_JOB_TRIGGER_EXCHANGE = `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`;
export const DOWNLOAD_UPDATE_EXCHANGE = `${DOWNLOAD_PREFIX}.${UPDATE_SUFFIX}`;
export const DOWNLOAD_TRIGGER_EXCHANGE = `${DOWNLOAD_PREFIX}.${TRIGGER_SUFFIX}`;

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
