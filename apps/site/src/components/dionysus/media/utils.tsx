import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { SearchExecutionStatus } from "@ncfritz/olympus-sdk/dionysus";
import { Tag } from "antd";
import React, { type CSSProperties } from "react";
import SearchResultTag from "./SearchResultTag";

export const getMediaAssetSearchExecutionStatusIndicator = (
  status: SearchExecutionStatus,
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
    case "skipped":
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

export const getSource = (source: number) => {
  return (
    <SearchResultTag color={getSourceColor(source)}>
      {getSourceText(source)}
    </SearchResultTag>
  );
};
const getSourceText = (source: number) => {
  switch (source) {
    case 1:
      return "Cam";
    case 2:
      return "TeyeSync";
    case 3:
      return "TeleCine";
    case 4:
      return "Workprint";
    case 5:
      return "DVD";
    case 6:
      return "TV";
    case 7:
      return "WEB-DL";
    case 8:
      return "WEBRip";
    case 9:
      return "BluRay";
    default:
      return "Unknown";
  }
};
const getSourceColor = (source: number) => {
  switch (source) {
    case 1:
      return "#de425b";
    case 2:
      return "#de425b";
    case 3:
      return "#de425b";
    case 4:
      return "#f27b58";
    case 5:
      return "#fbaf68";
    case 6:
      return "#fbaf68";
    case 7:
      return "#488f31";
    case 8:
      return "#488f31";
    case 9:
      return "#8baa47";
    default:
      return "#666666";
  }
};

export const getModifier = (modiifer: number) => {
  return <SearchResultTag>{getModifierText(modiifer)}</SearchResultTag>;
};
export const getModifierText = (modiifer: number) => {
  switch (modiifer) {
    case 1:
      return "Regional";
    case 2:
      return "Screener";
    case 3:
      return "RawHD";
    case 4:
      return "BD-Disk";
    case 5:
      return "Remux";
    default:
      return "";
  }
};

export const getGroupColor = (group: string) => {
  switch (group) {
    case "Pre-Release":
      return "#de425b";
    case "SD":
      return "#f27b58";
    case "HDTV":
      return "#c7c566";
    case "WEBDL":
      return "#488f31";
    case "Bluray":
      return "#8baa47";
    case "WEBRip":
      return "#488f31";
    default:
      return "#666666";
  }
};
export const getGroupTag = (group: string) => {
  return (
    <SearchResultTag color={getGroupColor(group)}>{group}</SearchResultTag>
  );
};

export const getResolutionColor = (resolution: number) => {
  if (resolution <= 360) {
    return "#de425b";
  } else if (resolution <= 44) {
    return "#f57e55";
  } else if (resolution <= 540) {
    return "#feb663";
  } else if (resolution <= 576) {
    return "#ffeb8a";
  } else if (resolution <= 720) {
    return "#afcd77";
  } else if (resolution <= 1080) {
    return "#64ab71";
  } else if (resolution <= 2160) {
    return "#488f31";
  }

  return "#666666";
};

export const getResolutionTag = (resolution: number) => {
  return (
    <SearchResultTag color={getResolutionColor(resolution)}>
      {resolution === 0 ? "Unknown" : `${resolution}p`}
    </SearchResultTag>
  );
};

export const getResolutionTransparency = (resolution: number) => {
  if (resolution <= 360) {
    return "99";
  } else if (resolution <= 480) {
    return "aa";
  } else if (resolution <= 540) {
    return "bb";
  } else if (resolution <= 576) {
    return "cc";
  } else if (resolution <= 720) {
    return "dd";
  } else if (resolution <= 1080) {
    return "ee";
  } else if (resolution <= 2160) {
    return "ff";
  }

  return "ff";
};
