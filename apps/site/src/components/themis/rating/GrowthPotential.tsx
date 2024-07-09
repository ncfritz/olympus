import { Typography } from "antd";
import React from "react";
import type { PotentialRating } from "../../../types/themis";
import { potentialColors, type RatingSize } from "./constants";

export interface PotentialProps {
  rating: PotentialRating;
  undecoratedText?: boolean;
  size?: RatingSize;
}

const labels: Record<PotentialRating, string> = {
  Unknown: "--",
  NA: "Not Available",
  L: "Low",
  M: "Medium",
  H: "High",
  VH: "Very High",
};

const GrowthPotential: React.FunctionComponent<PotentialProps> = ({
  rating,
  undecoratedText = false,
  size = "regular",
}) => {
  let ratingText: string = "--";

  if (undecoratedText) {
    if (rating !== "Unknown") {
      ratingText = rating;
    }
  } else {
    ratingText = rating !== null ? labels[rating] : "Unknown";
  }

  return (
    <Typography.Text
      style={{
        fontSize: undecoratedText ? 11 : 14,
        borderColor: potentialColors[rating],
        backgroundColor: `${potentialColors[rating]}33`,
        borderWidth: 4,
        borderStyle: "solid",
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: size === "small" ? 2 : 8,
        paddingBottom: size === "small" ? 2 : 8,
        display: "flex",
        margin: 2,
        flexGrow: 1,
        maxHeight: undecoratedText ? 32 : "inherit",
      }}
    >
      {ratingText}
    </Typography.Text>
  );
};
export default GrowthPotential;
