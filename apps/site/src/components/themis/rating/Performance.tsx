import { Space, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";

import React, { type ReactElement } from "react";
import type { PerformanceRating } from "../../../types/themis";
import { performanceRatingColors, type RatingSize } from "./constants";

export interface PerformanceProps {
  rating: PerformanceRating;
  undecoratedText?: boolean;
  size?: RatingSize;
}

const labels: Record<PerformanceRating, ReactElement> = {
  Unknown: <Space size={4}>--</Space>,
  NA: <Space size={4}>Not Available</Space>,
  NI1: (
    <Space size={4}>
      (1) Lowers <ArrowDownOutlined />
    </Space>
  ),
  NI2: <Space size={4}>(2) Lowers</Space>,
  NI3: (
    <Space size={4}>
      (3) Lowers <ArrowUpOutlined />
    </Space>
  ),
  M1: (
    <Space size={4}>
      (4) Meets <ArrowDownOutlined />
    </Space>
  ),
  M2: (
    <Space size={4}>
      (5) Meets <ArrowUpOutlined />
    </Space>
  ),
  E1: (
    <Space size={4}>
      (6) Exceeds <ArrowDownOutlined />
    </Space>
  ),
  E2: (
    <Space size={4}>
      (7) Exceeds <ArrowUpOutlined />
    </Space>
  ),
};

const Performance: React.FunctionComponent<PerformanceProps> = ({
  rating,
  undecoratedText = false,
  size = "regular",
}) => {
  let ratingText: string | ReactElement = "--";

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
        borderColor: performanceRatingColors[rating],
        backgroundColor: `${performanceRatingColors[rating]}33`,
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
export default Performance;
