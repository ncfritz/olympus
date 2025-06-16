import { Select } from "antd";
import React, { type CSSProperties } from "react";
import { JobStatus } from "../../../types/dionysus";
import { getBatchJobStatusIndicator } from "./utils";

export interface BatchJobStatusSelectProps {
  value: string;
  onChange: (value: string) => void;
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
          value: JobStatus.CREATED,
          label: getBatchJobStatusIndicator(JobStatus.CREATED, true),
        },
        {
          value: JobStatus.STARTED,
          label: getBatchJobStatusIndicator(JobStatus.STARTED, true),
        },
        {
          value: JobStatus.SUCCESS,
          label: getBatchJobStatusIndicator(JobStatus.SUCCESS, true),
        },
        {
          value: JobStatus.FAILED,
          label: getBatchJobStatusIndicator(JobStatus.FAILED, true),
        },
        {
          value: JobStatus.CANCELLED,
          label: getBatchJobStatusIndicator(JobStatus.CANCELLED, true),
        },
      ]}
    />
  );
};
export default BatchJobStatusSelect;
