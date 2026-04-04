import {
  AudioOutlined,
  BgColorsOutlined,
  CloudServerOutlined,
  CustomerServiceOutlined,
  ExperimentOutlined,
  EyeOutlined,
  ScanOutlined,
  StopOutlined,
  UsergroupAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  SearchResultTag,
  SearchResultTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Space, Typography } from "antd";

export interface SearchResultMetaTagProps {
  tag: SearchResultTag;
}

const getIconForType = (type: SearchResultTagType) => {
  switch (type) {
    case "audioChannel":
      return <CustomerServiceOutlined />;
    case "audioFormat":
      return <AudioOutlined />;
    case "hdr":
      return <BgColorsOutlined />;
    case "misc":
      return <ExperimentOutlined />;
    case "movieVersion":
      return <EyeOutlined />;
    case "releaseGroups":
      return <UsergroupAddOutlined />;
    case "resolution":
      return <ScanOutlined />;
    case "streamingServices":
      return <CloudServerOutlined />;
    case "unwanted":
      return <StopOutlined />;
    case "videoCodec":
      return <VideoCameraOutlined />;
  }
};

const getColorForType = (type: SearchResultTagType) => {
  switch (type) {
    case "audioChannel":
      return "#1e3b14";
    case "audioFormat":
      return "#275916";
    case "hdr":
      return "#142737";
    case "misc":
      return "#276014";
    case "movieVersion":
      return "#142737";
    case "releaseGroups":
      return "#333333";
    case "resolution":
      return "#1D2E3B";
    case "streamingServices":
      return "#833683";
    case "unwanted":
      return "#7d0000";
    case "videoCodec":
      return "#2657a8";
  }
};

const getLabelForType = (type: SearchResultTagType) => {
  switch (type) {
    case "audioChannel":
      return "Channels";
    case "audioFormat":
      return "Format";
    case "hdr":
      return "HDR";
    case "misc":
      return "Misc";
    case "movieVersion":
      return "Version";
    case "releaseGroups":
      return "Group";
    case "resolution":
      return "Res";
    case "streamingServices":
      return "Stream";
    case "unwanted":
      return "Unwanted";
    case "videoCodec":
      return "Codec";
  }
};

const SearchResultMetaTag: React.FunctionComponent<
  SearchResultMetaTagProps
> = ({ tag }: SearchResultMetaTagProps) => {
  return (
    <Space
      direction={"horizontal"}
      style={{
        background: "#ffffff",
        borderRadius: 4,
        border: `1px solid #dddddd`,
        alignItems: "center",
        lineHeight: "14px",
      }}
      size={0}
    >
      <Typography.Text
        style={{
          fontSize: "11px",
          color: "#ffffff",
          padding: 2,
          paddingLeft: 4,
          paddingRight: 4,
          background: getColorForType(tag.type),
          borderBottomLeftRadius: 4,
          borderTopLeftRadius: 4,
        }}
      >
        <Space direction={"horizontal"} size={4} style={{ paddingRight: 4 }}>
          {getIconForType(tag.type)}
          {getLabelForType(tag.type)}
        </Space>
      </Typography.Text>
      <Typography.Text
        style={{ fontSize: "11px", paddingLeft: 8, paddingRight: 8 }}
      >
        {tag.value}
      </Typography.Text>
      <Typography.Text
        style={{
          fontSize: "11px",
          fontFamily: "monospace",
          padding: 2,
          paddingLeft: 8,
          paddingRight: 8,
          background: "#eeeeee",
        }}
      >
        {tag.score}
      </Typography.Text>
    </Space>
  );
};
export default SearchResultMetaTag;
