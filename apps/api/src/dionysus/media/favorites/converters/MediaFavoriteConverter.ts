import { MediaFavorite, SparseMediaFavorite } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import type {
  GraphQlMediaFavorite,
  GraphQlSparseMediaFavorite,
} from "../types/mediaFavorite";
import { toMediaWorkflowDecorationDomainObject } from "../../workflows/converters/MediaAssetWorkflowConverter";

export const toSparseDomainObject = (
  input: GraphQlSparseMediaFavorite,
): SparseMediaFavorite => {
  return {
    createdTime: moment(input.createdTime),
  };
};

export const toDomainObject = (input: GraphQlMediaFavorite): MediaFavorite => {
  return {
    ...toSparseDomainObject(input),
    decoration: toMediaWorkflowDecorationDomainObject(input.decoration),
  };
};
