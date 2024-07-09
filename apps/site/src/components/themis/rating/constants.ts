import type {
  CriticalityRating,
  OverallRating,
  PerformanceRating,
  PotentialRating,
} from "../../../types/themis";

export type RatingSize = "regular" | "small";

export const overallRatingColors: Record<OverallRating, string> = {
  Unknown: "#666666",
  NA: "#666666",
  LE: "#ff0000",
  HV1: "#ef7d00",
  HV2: "#d5e000",
  HV3: "#59d000",
  TT: "#00c012",
};

export const performanceRatingColors: Record<PerformanceRating, string> = {
  Unknown: "#666666",
  NA: "#666666",
  NI1: "#ff0000",
  NI2: "#f55500",
  NI3: "#eaa300",
  M1: "#d5e000",
  M2: "#81d500",
  E1: "#34cb00",
  E2: "#00c012",
};

export const potentialColors: Record<PotentialRating, string> = {
  Unknown: "#666666",
  NA: "#666666",
  L: "#ff0000",
  M: "#eaa300",
  H: "#81d500",
  VH: "#00c012",
};

export const criticalityColors: Record<CriticalityRating, string> = {
  Unknown: "#666666",
  l: "#ff0000",
  m: "#eaa300",
  h: "#81d500",
  vh: "#00c012",
};
