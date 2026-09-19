import {
  MediaAssetDownload,
  MediaAssetSearchResult,
  SearchResultTag,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlMediaAssetSearchResult,
  GraphQlMediaAssetSearchResultTag,
} from "../types/searchResult";
import { toDomainObject as toDownloadDomainObject } from "../../downloads/converters/MediaAssetDownloadConverter";

export const toDomainObject = (
  input: GraphQlMediaAssetSearchResult,
): MediaAssetSearchResult => {
  const tags: SearchResultTag[] = [];
  const downloads: MediaAssetDownload[] = [];

  if (input.tags) {
    input.tags.forEach((entity) => {
      tags.push(toTagDomainObject(entity));
    });
  }

  if (input.downloads) {
    input.downloads.forEach((entity) => {
      downloads.push(toDownloadDomainObject(entity));
    });
  }

  return {
    id: input.id,
    title: input.title,
    status: input.status,
    score: input.score,
    size: input.size,
    password: input.password,
    quality: input.quality,
    qualityGroup: input.qualityGroup,
    source: input.source,
    modifier: input.modifier,
    resolution: input.resolution,
    repack: input.repack,
    postedTime: moment(input.postedTime),
    createdTime: moment(input.createdTime),
    tags: tags,
    downloads: downloads,
  };
};

export const toTagDomainObject = (
  input: GraphQlMediaAssetSearchResultTag,
): SearchResultTag => {
  return {
    type: input.type,
    value: input.value,
    score: input.score,
    createdTime: moment(input.createdTime),
  };
};
