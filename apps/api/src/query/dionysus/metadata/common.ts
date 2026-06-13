import { SortDirection } from "@ncfritz/olympus-model";
import { SPARSE_TV_EPISODE } from "./tvEpisode";

export const BASE_EXTERNAL_ID = `type
  externalId
  createdTime
  lastUpdatedTime`;

export const EXTERNAL_IDS = `externalIds {
    ${BASE_EXTERNAL_ID}
  }`;

export const BASE_LANGUAGE = `id
  name
  nativeName
  createdTime
  lastUpdatedTime`;

export const LANGUAGE_ASSOCIATION = `createdTime
  lastUpdatedTime
  language {
    ${BASE_LANGUAGE}
  }`;

export const LANGUAGES = `languages {
    ${LANGUAGE_ASSOCIATION}
  }`;

export const BASE_COUNTRY = `id
  name
  createdTime
  lastUpdatedTime`;

export const COUNTRY_ASSOCIATION = `createdTime
  lastUpdatedTime
  country {
    ${BASE_COUNTRY}
  }`;

export const BASE_ALTERNATIVE_TITLE = `title
  type
  createdTime
  lastUpdatedTime
  country {
    ${BASE_COUNTRY}
  }`;

export const ALTERNATIVE_TITLES = `alternativeTitles {
    ${BASE_ALTERNATIVE_TITLE}
  }`;

export const BASE_ALTERNATIVE_NAME = `name
  type
  createdTime
  lastUpdatedTime`;

export const ALTERNATIVE_NAMES = `alternativeNames {
    ${BASE_ALTERNATIVE_NAME}
  }`;

export const BASE_IMAGE = `width
  height
  filePath
  createdTime
  lastUpdatedTime`;

export const BASE_TYPED_IMAGE = `${BASE_IMAGE}
  type
  language {
    ${BASE_LANGUAGE}
  }`;

export const TYPED_IMAGES = `images {
    ${BASE_TYPED_IMAGE}
  }`;

export const BASE_IDENTIFIABLE_IMAGE = `${BASE_IMAGE}
  id
  fileType`;

export const IDENTIFIABLE_IMAGE = `images {
    ${BASE_IDENTIFIABLE_IMAGE}
  }`;

export const BASE_VIDEO = `id
  name
  key
  site
  size
  type
  official
  publishedTime
  createdTime
  lastUpdatedTime
  country {
    ${BASE_COUNTRY}
  }
  language {
    ${BASE_LANGUAGE}
  }`;

export const VIDEOS = `videos {
    ${BASE_VIDEO}
  }`;

export const BASE_RUNTIME = `runTIme
  createdTime
  lastUpdatedTime`;

export const TV_EPISODE_RUNTIMES = `episodeRunTimes3 {
    ${BASE_RUNTIME}
  }`;

export const SPARSE_TV_EPISODES = (sort?: {
  field: string;
  order: SortDirection;
}) => {
  return `episodes(order_by${sort ? `: { ${sort.field}: ${sort.order}})` : ""} {
    ${SPARSE_TV_EPISODE}
  }`;
};
