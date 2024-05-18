import { ContentAsset } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import {
  GraphQLContentAsset,
} from "../../types/content";
import { toDomainObject as toTagDomainObject } from "./ContentAssetTagConverter";

export const toDomainObject = (
  input: GraphQLContentAsset,
): ContentAsset => {
  return {
    id: input.content_id,
    createdTime: moment(input.createdTime),
    name: input.name,
    originalName: input.original_name,
    originalSha: input.original_sha,
    originalSizeBytes: input.original_size,
    newSha: input.asset_sha,
    newSizeBytes: input.asset_size,
    durationMs: input.duration,
    width: input.width,
    height: input.height,
    rating: input.rating,
    tags:
      input.asset_tags &&
      input.asset_tags.map((tag) => toTagDomainObject(tag.tag)),
  };
};
