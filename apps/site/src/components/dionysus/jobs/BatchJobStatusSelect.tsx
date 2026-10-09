import { Select } from "antd";
import React, { type CSSProperties } from "react";
import { getBatchJobStatusIndicator } from "./utils";
import { type JobStatus } from "@ncfritz/olympus-sdk/dionysus";

export interface BatchJobStatusSelectProps {
  value: string;
  onChange: (value: JobStatus) => void;
  style?: CSSProperties;
  bordered?: boolean;
}

const BatchJobStatusSelect: React.FunctionComponent<
  BatchJobStatusSelectProps
> = ({
  value,
  onChange,
  style,
  bordered = false,
}: BatchJobStatusSelectProps) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={style || { width: 200 }}
      variant={bordered ? "outlined" : "borderless"}
      options={[
        {
          value: "created",
          label: getBatchJobStatusIndicator("created", true),
        },
        {
          value: "started",
          label: getBatchJobStatusIndicator("started", true),
        },
        {
          value: "success",
          label: getBatchJobStatusIndicator("success", true),
        },
        {
          value: "failed",
          label: getBatchJobStatusIndicator("failed", true),
        },
        {
          value: "cancelled",
          label: getBatchJobStatusIndicator("cancelled", true),
        },
      ]}
    />
  );
};
export default BatchJobStatusSelect;
