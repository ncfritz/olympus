import { Typography } from "antd";
import React from "react";

export interface MonoNumberProps {
  value?: number;
  defaultValue?: number;
}

export const MonoNumber: React.FunctionComponent<MonoNumberProps> = ({
  value,
  defaultValue = 0,
}: MonoNumberProps) => {
  return (
    <Typography.Text style={{ fontFamily: "monospace", fontSize: "11px" }}>
      {value ? value.toLocaleString() : defaultValue?.toLocaleString()}
    </Typography.Text>
  );
};
