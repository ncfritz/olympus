import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  PauseCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";
import React, { type CSSProperties } from "react";
import {
  type WorkflowStatus,
  type JobStatus,
} from "@ncfritz/olympus-sdk/dionysus";

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
        <Tag color={"#f4a002"} icon={<ClockCircleOutlined />} style={style}>
          Queued
        </Tag>
      );
    case "invalidated":
      return (
        <Tag color={"#764f90"} icon={<PauseCircleOutlined />} style={style}>
          Invalidated
        </Tag>
      );
    case "fetching":
      return (
        <Tag
          color={"#364a7c"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Fetching
        </Tag>
      );
    case "cancelled":
      return (
        <Tag color={"#ff764a"} icon={<StopOutlined />} style={style}>
          Cancelled
        </Tag>
      );
    case "fetched":
      return (
        <Tag color={"#023e5a"} icon={<CheckCircleOutlined />} style={style}>
          Fetched
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#b54e8b"} icon={<CloseCircleOutlined />} style={style}>
          Failed
        </Tag>
      );
    case "not_found":
      return (
        <Tag color={"#ef5675"} icon={<SearchOutlined />} style={style}>
          Not Found
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

export const getBatchJobStatusIndicator = (
  status: JobStatus,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case "created":
      return (
        <Tag color={"#003f5c"} icon={<ClockCircleOutlined />} style={style}>
          Created
        </Tag>
      );
    case "started":
      return (
        <Tag
          color={"#58508d"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Running
        </Tag>
      );
    case "cancelled":
      return (
        <Tag color={"#ffa600"} icon={<MinusCircleOutlined />} style={style}>
          Cancelled
        </Tag>
      );
    case "success":
      return (
        <Tag color={"#bc5090"} icon={<CheckCircleOutlined />} style={style}>
          Success
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#ff6361"} icon={<CloseCircleOutlined />} style={style}>
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

export const getMetadataWorkflowStatusIndicator = (
  status: WorkflowStatus,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case "created":
      return (
        <Tag color={"#003f5c"} icon={<ClockCircleOutlined />} style={style}>
          Created
        </Tag>
      );
    case "started":
      return (
        <Tag
          color={"#58508d"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Running
        </Tag>
      );
    case "success":
      return (
        <Tag color={"#bc5090"} icon={<CheckCircleOutlined />} style={style}>
          Success
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#ff6361"} icon={<CloseCircleOutlined />} style={style}>
          Failed
        </Tag>
      );
    case "cancelled":
      return (
        <Tag color={"#ffa600"} icon={<MinusCircleOutlined />} style={style}>
          Cancelled
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
