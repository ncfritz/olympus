import {
  ContentAssetChannelCacheEntry,
  ContentAssetChannel,
  FullContentAssetChannel,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlContentAssetChannel,
  GraphQlContentAssetChannelCacheEntry,
  GraphQlFullContentAssetChannel,
} from "../../types/content";
import { toDomainObject as toContentAssetChannelCategoryDomainObject } from "./ContentAssetChannelCategoryConverter";

export const toDomainObject = (
  input: GraphQlContentAssetChannel,
): ContentAssetChannel => {
  const assetCache: ContentAssetChannelCacheEntry[] = [];

  if (input.assetCache) {
    input.assetCache.forEach((entry) => {
      assetCache.push(toAssetCacheDomainObject(entry));
    });
  }

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    filterInput: input.filterInput,
    encodedFilter: input.encodedFilter,
    ttl: input.ttl,
    jitter: input.jitter,
    favorite: input.favorite,
    bcCompliant: input.bcCompliant,
    lastFetchedTime: moment(input.createdTime),
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.createdTime),
    assetCount: input.assetCount,
    assetCache: assetCache,
  };
};

export const toFullDomainObject = (
  input: GraphQlFullContentAssetChannel,
): FullContentAssetChannel => {
  return {
    ...toDomainObject(input),
    category: toContentAssetChannelCategoryDomainObject(input.category),
  };
};

const toAssetCacheDomainObject = (
  input: GraphQlContentAssetChannelCacheEntry,
): ContentAssetChannelCacheEntry => {
  return {
    assetId: input.assetId,
    width: input.width,
    height: input.height,
    lastFetchedTime: moment(input.lastFetchedTime),
  };
};
