import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  QuestionCircleOutlined,
  StopOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";
import React, { type CSSProperties } from "react";

export const getMetadataJobStatusIndicator = (
  status: string,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case "queued":
      return (
        <Tag color={"#ffa600"} icon={<ClockCircleOutlined />} style={style}>
          Queued
        </Tag>
      );
    case "invalidated":
      return (
        <Tag color={"#ff6e54"} icon={<PauseCircleOutlined />} style={style}>
          Invalidated
        </Tag>
      );
    case "fetching":
      return (
        <Tag
          color={"#dd5182"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Fetching
        </Tag>
      );
    case "cancelled":
      return (
        <Tag color={"#955196"} icon={<StopOutlined />} style={style}>
          Cancelled
        </Tag>
      );
    case "fetched":
      return (
        <Tag color={"#444e86"} icon={<CheckCircleOutlined />} style={style}>
          Fetched
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#003f5c"} icon={<CloseCircleOutlined />} style={style}>
          Failed
        </Tag>
      );
    default:
      return (
        <Tag icon={<QuestionCircleOutlined />} style={style}>
          Unknown
        </Tag>
      );
  }
};
