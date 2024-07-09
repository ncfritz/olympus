import { Typography } from "antd";
import React from "react";
import type { CriticalityRating } from "../../../types/themis";
import { criticalityColors } from "./constants";

export interface PotentialProps {
  rating: CriticalityRating;
  undecoratedText?: boolean;
}

const labels: Record<CriticalityRating, string> = {
  Unknown: "--",
  l: "Low",
  m: "Moderate",
  h: "High",
  vh: "Very High",
};

const Potential: React.FunctionComponent<PotentialProps> = ({
  rating = "Unknown",
  undecoratedText = false,
}) => {
  let ratingText: any = "Unknown";

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
        borderColor: criticalityColors[rating],
        backgroundColor: `${criticalityColors[rating]}33`,
        borderWidth: 4,
        borderStyle: "solid",
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 8,
        paddingBottom: 8,
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
export default Potential;
