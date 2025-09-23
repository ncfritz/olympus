import { Select } from "antd";
import React, { type CSSProperties } from "react";
import { getMetadataWorkflowStatusIndicator } from "./utils";
import { type WorkflowStatus } from "@ncfritz/olympus-sdk/dionysus";

export interface WorkflowStatusSelectProps {
  value: string;
  onChange: (value: WorkflowStatus) => void;
  style?: CSSProperties;
  bordered?: boolean;
}

const WorkflowStatusSelect: React.FunctionComponent<
  WorkflowStatusSelectProps
> = ({
  value,
  onChange,
  style,
  bordered = false,
}: WorkflowStatusSelectProps) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={style || { width: 200 }}
      variant={bordered ? "outlined" : "borderless"}
      options={[
        {
          value: "created",
          label: getMetadataWorkflowStatusIndicator("created", true),
        },
        {
          value: "started",
          label: getMetadataWorkflowStatusIndicator("started", true),
        },
        {
          value: "success",
          label: getMetadataWorkflowStatusIndicator("success", true),
        },
        {
          value: "failed",
          label: getMetadataWorkflowStatusIndicator("failed", true),
        },
        {
          value: "cancelled",
          label: getMetadataWorkflowStatusIndicator("cancelled", true),
        },
      ]}
    />
  );
};
export default WorkflowStatusSelect;
