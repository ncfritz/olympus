import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  HourglassOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type {
  MediaAssetDownload,
  MediaAssetSearchConfigurationStatus,
  MediaAssetWorkflowStep, MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  MediaDownloadStatus,
  SearchExecutionStatus
} from "@ncfritz/olympus-sdk/dionysus";
import type { StepItem } from "@rc-component/steps/lib/Steps";
import { Tag } from "antd";
import React, { type CSSProperties } from "react";
import SearchResultTag from "./SearchResultTag";

export const getMediaAssetSearchConfigurationStatusIndicator = (
  status: MediaAssetSearchConfigurationStatus,
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
          variant={"solid"}
        >
          Running
        </Tag>
      );
    case "error":
      return (
        <Tag
          color={"#ffa600"}
          icon={<MinusCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Skipped
        </Tag>
      );
    case "ok":
      return (
        <Tag
          color={"#bc5090"}
          icon={<CheckCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Success
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

export const getMediaAssetSearchExecutionStatusColor = (
  status: SearchExecutionStatus | "none",
) => {
  switch (status) {
    case "running":
      return "#58508d";
    case "skipped":
      return "#ffa600";
    case "success":
      return "#bc5090";
    case "failed":
      return "#ff6361";
    default:
      return "#eeeeee";
  }
};

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
          variant={"solid"}
        >
          Running
        </Tag>
      );
    case "skipped":
      return (
        <Tag
          color={"#ffa600"}
          icon={<MinusCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Skipped
        </Tag>
      );
    case "success":
      return (
        <Tag
          color={"#bc5090"}
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
          color={"#ff6361"}
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

export const getDownloadStepProperties = (
  download?: MediaAssetDownload,
  includeClassName: boolean = true,
): Partial<StepItem> => {
  let icon = undefined;
  let status: "wait" | "process" | "finish" | "error" | undefined = "wait";
  let className: string | undefined = undefined;

  switch (download?.status) {
    case "pending":
      icon = (
        <HourglassOutlined style={{ color: "#ffffff", fontSize: "16px" }} />
      );
      className = "dionysus-step-paused";
      break;
    case "downloading":
      status = "process";
      icon = <LoadingOutlined />;
      break;
    case "success":
      status = "finish";
      break;
    case "failed":
      status = "error";
      break;
    case "cancelled":
      status = "finish";
      break;
  }

  return {
    disabled: !download,
    icon: icon,
    status: status,
    className: includeClassName ? className : undefined,
  };
};

export const getMediaAssetDownloadStatusIndicator = (
  status: MediaDownloadStatus,
  fullWidth = false,
) => {
  const style: CSSProperties = { minWidth: 120 };

  if (fullWidth) {
    style.width = "calc(100% - 8px)";
  }

  switch (status) {
    case "downloading":
      return (
        <Tag
          color={"#554d87"}
          icon={<SyncOutlined spin={true} />}
          style={style}
          variant={"solid"}
        >
          Downloading
        </Tag>
      );
    case "cancelled":
      return (
        <Tag
          color={"#f39f01"}
          icon={<MinusCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Cancelled
        </Tag>
      );
    case "failed":
      return (
        <Tag
          color={"#f35f5e"}
          icon={<MinusCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Failed
        </Tag>
      );
    case "success":
      return (
        <Tag
          color={"#b44d8a"}
          icon={<CheckCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Success
        </Tag>
      );
    case "pending":
      return (
        <Tag
          color={"#013d59"}
          icon={<HourglassOutlined />}
          style={style}
          variant={"solid"}
        >
          Pending
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

export const getStepProperties = (
  steps: MediaAssetWorkflowStep[],
  stepType: MediaAssetWorkflowStepType,
  includeClassName: boolean = true,
): Partial<StepItem> => {
  let icon = undefined;
  let status: "wait" | "process" | "finish" | "error" | undefined = "wait";
  let className: string | undefined = undefined;

  const candidateSteps = steps?.filter((s) => s.type === stepType);
  const step = candidateSteps?.[0];

  if (step) {
    switch (step.status) {
      case "pending":
        icon = (
          <HourglassOutlined style={{ color: "#ffffff", fontSize: "16px" }} />
        );
        className = "dionysus-step-paused";
        break;
      case "running":
        status = "process";
        icon = <LoadingOutlined />;
        break;
      case "success":
        status = "finish";
        break;
      case "skipped":
        status = "finish";
        break;
      case "failed":
        status = "error";
        break;
    }
  }

  return {
    disabled: !step,
    icon: icon,
    status: status,
    className: includeClassName ? className : undefined,
  };
};

export const getStepStatusIndicator = (
  status: MediaAssetWorkflowStepStatus,
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
          color={"#554d87"}
          icon={<SyncOutlined spin={true} />}
          style={style}
          variant={"solid"}
        >
          Running
        </Tag>
      );
    case "skipped":
      return (
        <Tag
          color={"#f39f01"}
          icon={<MinusCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Skipped
        </Tag>
      );
    case "failed":
      return (
        <Tag
          color={"#f35f5e"}
          icon={<MinusCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Failed
        </Tag>
      );
    case "success":
      return (
        <Tag
          color={"#b44d8a"}
          icon={<CheckCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Success
        </Tag>
      );
    case "pending":
      return (
        <Tag
          color={"#013d59"}
          icon={<CheckCircleOutlined />}
          style={style}
          variant={"solid"}
        >
          Pending
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

export const getStepLabel = (stepType: MediaAssetWorkflowStepType) => {
  switch (stepType) {
    case "extract_original_metadata":
      return "Extract Original Metadata";
    case "extract_new_metadata":
      return "Extract New Metadata";
    case "configure_transcode":
      return "Configure Transcode";
    case "transcode":
      return "Transcode";
    case "verify_transcode":
      return "Verify Transcode";
    case "upload":
      return "Upload";
    case "cleanup":
      return "Cleanup";
  }
};

export const getDownloadProgressColor = (status: string) => {
  switch (status) {
    case "downloading":
      return "#023c53";
    case "pending":
      return "#833683";
    case "success":
      return "#275916";
    case "failed":
      return "#7d0000";
    case "cancelled":
      return "#c5981c";
    default:
      return "#666666";
  }
};

export const getDownloadProgressLabel = (status: string) => {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "exception";
    case "cancelled":
      return "exception";
    case "downloading":
    case "pending":
    default:
      return "normal";
  }
};

export const getDownloadProgressStepStatus = (
  status: string,
): "process" | "wait" | "finish" | "error" | undefined => {
  switch (status) {
    case "downloading":
      return "process";
    case "pending":
      return "wait";
    case "success":
      return "finish";
    case "failed":
      return "error";
    case "cancelled":
      return "error";
    default:
      return "wait";
  }
};
