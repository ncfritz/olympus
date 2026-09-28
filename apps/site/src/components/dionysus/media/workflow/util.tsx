import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PauseCircleFilled,
  QuestionCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { MediaAssetWorkflowStatus } from "@ncfritz/olympus-sdk/dionysus";
import { Tag } from "antd";
import React, { type CSSProperties } from "react";

export const getWorkflowStatusColor = (status: MediaAssetWorkflowStatus) => {
  switch (status) {
    case "queued":
      return "#833683";
    case "pending_input":
      return "#c5981c";
    case "running":
      return "#023c53";
    case "success":
      return "#275916";
    case "failed":
      return "#7d0000";
    default:
      return "#666666";
  }
};

export const getWorkflowStatusIndicator = (
  status: MediaAssetWorkflowStatus,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case "queued":
      return (
        <Tag
          color={getWorkflowStatusColor(status)}
          icon={<ClockCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Queued
        </Tag>
      );
    case "pending_input":
      return (
        <Tag
          color={getWorkflowStatusColor(status)}
          icon={<PauseCircleFilled />}
          style={style}
          variant={"solid"}
        >
          Pending Input
        </Tag>
      );
    case "running":
      return (
        <Tag
          color={getWorkflowStatusColor(status)}
          icon={<SyncOutlined spin={true} />}
          style={style}
          variant={"solid"}
        >
          Running
        </Tag>
      );
    case "success":
      return (
        <Tag
          color={getWorkflowStatusColor(status)}
          icon={<CheckCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Success
        </Tag>
      );
    case "failed":
      return (
        <Tag
          color={getWorkflowStatusColor(status)}
          icon={<CloseCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Failed
        </Tag>
      );
    default:
      return (
        <Tag icon={<QuestionCircleOutlined />} style={style} variant={"solid"}>
          Unknown
        </Tag>
      );
  }
};
