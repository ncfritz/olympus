import { CHANNEL_CATEGORY_WITH_CHANNEL_COUNT } from "./categories";

export const CHANNEL_ASSET_CACHE_ENTRY = `assetId
  createdTime`;

export const CHANNEL_ASSET_CACHE_ENTRY_WITH_DIMENSIONS = `
  ${CHANNEL_ASSET_CACHE_ENTRY}
  width
  height`;

export const BASE_CHANNEL = `id
  name
  description
  bcCompliant
  favorite
  filterInput
  encodedFilter
  ttl
  jitter
  createdTime
  lastUpdatedTime
  lastFetchedTime`;

export const CHANNEL_SUMMARY = `
  ${BASE_CHANNEL}
  categoryId
  assetCache {
    ${CHANNEL_ASSET_CACHE_ENTRY}
  }`;

export const FULL_CHANNEL = `
  ${BASE_CHANNEL}
  assetCount
  category {
    ${CHANNEL_CATEGORY_WITH_CHANNEL_COUNT}
  }
  assetCache {
    ${CHANNEL_ASSET_CACHE_ENTRY_WITH_DIMENSIONS}
  }`;
