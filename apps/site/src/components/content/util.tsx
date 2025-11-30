import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type {
  ContentAsset,
  ContentAssetTag,
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStepStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import { Tag } from "antd";
import React, { type CSSProperties } from "react";

export const getTagColor = (tag: ContentAssetTag): string => {
  switch (tag.type) {
    case "type":
      return "#aa0000";
    case "source":
      return "#6b32a8";
    case "system":
      return "#bf6c00";
    case "user":
      return "#0026bf";
    case "model":
      return "#33493f";
    default:
      return "#666666";
  }
};

export const getContentIngestionWorkflowStatusIndicator = (
  status: ContentIngestionWorkflowStatus,
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
    case "running":
      return (
        <Tag
          color={"#444e86"}
          icon={<SyncOutlined spin={true} />}
          style={style}
        >
          Running
        </Tag>
      );
    case "duplicate":
      return (
        <Tag color={"#955196"} icon={<CopyOutlined />} style={style}>
          Duplicate
        </Tag>
      );
    case "success":
      return (
        <Tag color={"#dd5182"} icon={<CheckCircleOutlined />} style={style}>
          Success
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#ff6e54"} icon={<CloseCircleOutlined />} style={style}>
          Failed
        </Tag>
      );
    case "skipped":
      return (
        <Tag color={"#ffa600"} icon={<MinusCircleOutlined />} style={style}>
          Skipped
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

export const getContentIngestionWorkflowStepStatusIndicator = (
  status: ContentIngestionWorkflowStepStatus,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case "running":
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
        <Tag color={"#bc5090"} icon={<MinusCircleOutlined />} style={style}>
          Success
        </Tag>
      );
    case "failed":
      return (
        <Tag color={"#ff6361"} icon={<CheckCircleOutlined />} style={style}>
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

export type AssetDimensionBounds = {
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
};

export const calculateAssetDimensions = (
  asset: ContentAsset,
  bounds: AssetDimensionBounds = {
    maxWidth: 800,
    maxHeight: 550,
    minWidth: 600,
    minHeight: 450,
  },
): [w: number, h: number, r: number, a: number] => {
  const ratio = asset.width / asset.height;
  let width = asset.width;
  let height = asset.height;
  let adjustment = 1;

  if (width < bounds.minWidth) {
    adjustment = bounds.minWidth / width;
  } else if (height < bounds.minHeight) {
    adjustment = bounds.minHeight / height;
  }

  width = width * adjustment;
  height = height * adjustment;

  if (width > bounds.maxWidth) {
    adjustment = bounds.maxWidth / width;
  } else if (height > bounds.maxHeight) {
    adjustment = bounds.maxHeight / height;
  }

  width = width * adjustment;
  height = height * adjustment;

  adjustment = asset.width / width;

  return [width, height, ratio, adjustment];
};
