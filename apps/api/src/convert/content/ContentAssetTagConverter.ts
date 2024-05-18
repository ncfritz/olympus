import { ContentAssetTag } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlContentAssetTag } from "../../types/content";

export const toDomainObject = (
  input: GraphQlContentAssetTag,
): ContentAssetTag => {
  return {
    id: input.content_tag_id,
    createdTime: moment(input.createdTime),
    name: input.name,
    type: input.type,
  };
};
