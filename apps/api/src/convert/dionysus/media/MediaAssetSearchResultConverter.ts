import { MediaAssetSearchResult } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMediaAssetSearchResult } from "../../../types/dionysus/media/searchResult";

export const toDomainObject = (
  input: GraphQlMediaAssetSearchResult,
): MediaAssetSearchResult => {
  return {
    id: input.id,
    title: input.title,
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
  };
};
