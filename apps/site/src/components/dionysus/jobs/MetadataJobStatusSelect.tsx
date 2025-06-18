import { Select } from "antd";
import React, { type CSSProperties } from "react";
import { getMetadataJobStatusIndicator } from "./utils";

export interface MetadataJobStatusSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  style?: CSSProperties;
  bordered?: boolean;
}

const MetadataJobStatusSelect: React.FunctionComponent<
  MetadataJobStatusSelectProps
> = ({
  value,
  onChange,
  style,
  bordered = false,
}: MetadataJobStatusSelectProps) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={style || { width: 200 }}
      variant={bordered ? "outlined" : "borderless"}
      options={[
        {
          value: "queued",
          label: getMetadataJobStatusIndicator("queued", true),
        },
        {
          value: "invalidated",
          label: getMetadataJobStatusIndicator("invalidated", true),
        },
        {
          value: "fetching",
          label: getMetadataJobStatusIndicator("fetching", true),
        },
        {
          value: "cancelled",
          label: getMetadataJobStatusIndicator("cancelled", true),
        },
        {
          value: "fetched",
          label: getMetadataJobStatusIndicator("fetched", true),
        },
        {
          value: "failed",
          label: getMetadataJobStatusIndicator("failed", true),
        },
        {
          value: "not_found",
          label: getMetadataJobStatusIndicator("not_found", true),
        },
      ]}
    />
  );
};
export default MetadataJobStatusSelect;
