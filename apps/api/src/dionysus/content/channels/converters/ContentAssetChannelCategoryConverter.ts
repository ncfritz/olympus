import {
  ContentAssetChannel,
  ContentAssetChannelCategory,
  FullContentAssetChannelCategory,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlContentAssetChannelCategory,
  GraphQlFullContentAssetChannelCategory,
} from "../../types/content";
import { toDomainObject as toContentAssetChannelDomainObject } from "./ContentAssetChannelConverter";

export const toDomainObject = (
  input: GraphQlContentAssetChannelCategory,
): ContentAssetChannelCategory => {
  return {
    id: input.id,
    name: input.name,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.createdTime),
    channelCount: input.channels_aggregate.aggregate.count,
  };
};

export const toFullDomainObject = (
  input: GraphQlFullContentAssetChannelCategory,
): FullContentAssetChannelCategory => {
  const channels: ContentAssetChannel[] = [];

  if (input.channels) {
    input.channels.forEach((entry) => {
      channels.push(toContentAssetChannelDomainObject(entry));
    });
  }

  return {
    ...toDomainObject(input),
    channels: channels,
  };
};
