export const BASE_CHANNEL_CATEGORY = `createdTime
  id
  lastUpdatedTime
  name`;

export const CHANNEL_CATEGORY_CHANNEL_COUNT = `channels_aggregate {
    aggregate {
      count
    }
  }`;

export const CHANNEL_CATEGORY_WITH_CHANNEL_COUNT = `
  ${BASE_CHANNEL_CATEGORY}
  ${CHANNEL_CATEGORY_CHANNEL_COUNT}`;
