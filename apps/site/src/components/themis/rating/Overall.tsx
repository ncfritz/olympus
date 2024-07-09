import { Typography } from "antd";

import React from "react";
import type { OverallRating } from "../../../types/themis";
import { overallRatingColors, type RatingSize } from "./constants";

export interface OverallProps {
  rating: OverallRating;
  undecoratedText?: boolean;
  size?: RatingSize;
}

const Overall: React.FunctionComponent<OverallProps> = ({
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
    ratingText = rating !== null ? rating : "Unknown";
  }

  return (
    <Typography.Text
      style={{
        fontSize: undecoratedText ? 11 : 14,
        borderColor: overallRatingColors[rating],
        backgroundColor: `${overallRatingColors[rating]}33`,
        borderWidth: 4,
        borderStyle: "solid",
        borderRadius: 10,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: size === "small" ? 2 : 8,
        paddingBottom: size === "small" ? 2 : 8,
        margin: 2,
        flexGrow: 1,
        maxHeight: undecoratedText ? 32 : "inherit",
      }}
    >
      {ratingText}
    </Typography.Text>
  );
};
export default Overall;
