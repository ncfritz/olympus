import { TYPED_IMAGES } from "../../queries/common";

export const BASE_COLLECTION = `id
  name
  overview
  posterPath
  backdropPath
  createdTime
  ${TYPED_IMAGES}`;
