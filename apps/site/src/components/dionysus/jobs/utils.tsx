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
import { JobStatus } from "../../../types/dionysus";

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
        <Tag color={"#003f5c"} icon={<ClockCircleOutlined />} style={style}>
          Queued
        </Tag>
      );
    case "invalidated":
      return (
        <Tag color={"#374c80"} icon={<PauseCircleOutlined />} style={style}>
          Invalidated
        </Tag>
      );
    case "fetching":
      return (
        <Tag
          color={"#7a5195"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Fetching
        </Tag>
      );
    case "cancelled":
      return (
        <Tag color={"#bc5090"} icon={<StopOutlined />} style={style}>
          Cancelled
        </Tag>
      );
    case "fetched":
      return (
        <Tag color={"#ef5675"} icon={<CheckCircleOutlined />} style={style}>
          Fetched
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#ff764a"} icon={<CloseCircleOutlined />} style={style}>
          Failed
        </Tag>
      );
    case "not_found":
      return (
        <Tag color={"#ffa600"} icon={<SearchOutlined />} style={style}>
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
  status: string,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case JobStatus.CREATED:
      return (
        <Tag color={"#003f5c"} icon={<ClockCircleOutlined />} style={style}>
          Created
        </Tag>
      );
    case JobStatus.STARTED:
      return (
        <Tag
          color={"#58508d"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Running
        </Tag>
      );
    case JobStatus.CANCELLED:
      return (
        <Tag color={"#ffa600"} icon={<MinusCircleOutlined />} style={style}>
          Cancelled
        </Tag>
      );
    case JobStatus.SUCCESS:
      return (
        <Tag color={"#bc5090"} icon={<CheckCircleOutlined />} style={style}>
          Success
        </Tag>
      );
    case JobStatus.FAILED:
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
  status: string,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case JobStatus.CREATED:
      return (
        <Tag color={"#003f5c"} icon={<ClockCircleOutlined />} style={style}>
          Created
        </Tag>
      );
    case JobStatus.STARTED:
      return (
        <Tag
          color={"#58508d"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Running
        </Tag>
      );
    case JobStatus.SUCCESS:
      return (
        <Tag color={"#bc5090"} icon={<CheckCircleOutlined />} style={style}>
          Success
        </Tag>
      );
    case JobStatus.FAILED:
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
