import {
  CaretRightOutlined,
  FileTextOutlined,
  ProfileOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import {
  Col,
  Collapse,
  type CollapseProps,
  Radio,
  Row,
  Space,
  Typography,
} from "antd";
import dynamic from "next/dynamic";
import { useState } from "react";
import { JsonIcon } from "../../icons";
import {
  disabled,
  enabled,
  getTitleExtra,
  metadataLabel,
  metadataValue,
  tagsSection,
} from "./MediaAssetFFMpegDetails";
import type { HandBrakeMetadata } from "../../utils/handbrake";
const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });

export interface MediaAssetHandbrakeDetailsProps {
  metadata: HandBrakeMetadata;
  showRaw: boolean;
  allowRawToggle?: boolean;
}

const MediaAssetHandbrakeDetails: React.FunctionComponent<
  MediaAssetHandbrakeDetailsProps
> = ({
  metadata,
  showRaw,
  allowRawToggle = false,
}: MediaAssetHandbrakeDetailsProps) => {
  const [displayStyle, setDisplayStyle] = useState<"form" | "raw">(
    showRaw ? "raw" : "form",
  );

  let content;
  const formatSelector = allowRawToggle ? (
    <Radio.Group
      size={"small"}
      optionType={"button"}
      defaultValue={displayStyle}
      className={"dionysus-filter-header"}
      onChange={(e) => {
        setDisplayStyle(e.target.value);
      }}
      options={[
        {
          value: "form",
          label: <ProfileOutlined />,
        },
        {
          value: "raw",
          label: <JsonIcon />,
        },
      ]}
    />
  ) : undefined;

  if (displayStyle === "raw") {
    content = (
      <Space orientation={"vertical"} size={0} style={{ width: "100%" }}>
        <Space
          orientation={"horizontal"}
          size={8}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Typography.Title level={5}>JSON</Typography.Title>
          {formatSelector}
        </Space>
        <DynamicReactJson
          style={{
            marginLeft: 24,
            fontSize: 10,
          }}
          src={metadata || {}}
          indentWidth={2}
          iconStyle={"square"}
          displayDataTypes={false}
          enableClipboard={true}
        />
      </Space>
    );
  } else {
    const title = metadata.TitleList[metadata.MainFeature];
    let audioStreams: CollapseProps["items"] = [];
    let subtitleStreams: CollapseProps["items"] = [];
    let chapters: CollapseProps["items"] = [];

    audioStreams = (title.AudioList ?? []).map((stream, index) => {
      return {
        label: (
          <Space orientation={"horizontal"} size={4}>
            <SoundOutlined />
            {stream.Description}
          </Space>
        ),
        key: `audioStream-${index}`,
        children: (
          <>
            <Row>
              {metadataLabel("Language")}
              {metadataValue(stream.Language)}
              {metadataLabel("Language Code")}
              {metadataValue(stream.LanguageCode)}
              {metadataLabel("Track")}
              {metadataValue(stream.TrackNumber)}
            </Row>
            <Row>
              {metadataLabel("Channels")}
              {metadataValue(stream.ChannelCount)}
              {metadataLabel("Channel Layout")}
              {metadataValue(stream.ChannelLayout)}
              {metadataLabel("Channel Layout Name")}
              {metadataValue(stream.ChannelLayoutName)}
            </Row>
            <Row>
              {metadataLabel("Codec")}
              {metadataValue(stream.CodecName)}
              {metadataLabel("Codec Id")}
              {metadataValue(stream.Codec)}
              {metadataLabel("Codec Param")}
              {metadataValue(stream.CodecParam)}
            </Row>
            <Row>
              {metadataLabel("Bit Rate")}
              {metadataValue(stream.BitRate)}
              {metadataLabel("Sample Rate")}
              {metadataValue(stream.SampleRate)}
              {metadataLabel("LFE Count")}
              {metadataValue(stream.LFECount)}
            </Row>
            <Row style={{ marginTop: 8, borderBottom: "1px solid #efefef" }}>
              <Col span={4}>
                <Typography.Text
                  strong={true}
                  style={{
                    display: "flex",
                    justifyContent: "end",
                    marginRight: 8,
                  }}
                >
                  Attributes
                </Typography.Text>
              </Col>
            </Row>
            <Row>
              {metadataLabel("Commentary", 4)}
              {metadataValue(
                stream.Attributes.Commentary ? enabled : disabled,
                1,
              )}
              {metadataLabel("Alt Commentary", 4)}
              {metadataValue(
                stream.Attributes.AltCommentary ? enabled : disabled,
                1,
              )}
              {metadataLabel("Default", 4)}
              {metadataValue(stream.Attributes.Default ? enabled : disabled, 1)}
              {metadataLabel("Normal", 4)}
              {metadataValue(stream.Attributes.Normal ? enabled : disabled, 1)}
            </Row>
            <Row>
              {metadataLabel("Secondary", 4)}
              {metadataValue(
                stream.Attributes.Secondary ? enabled : disabled,
                1,
              )}
              {metadataLabel("Visually Impaired", 4)}
              {metadataValue(
                stream.Attributes.VisuallyImpaired ? enabled : disabled,
                1,
              )}
            </Row>
          </>
        ),
      };
    });
    subtitleStreams = (title.SubtitleList ?? []).map((stream, index) => {
      const titleExtra = getTitleExtra(stream.LanguageCode, stream.Name);

      return {
        label: (
          <Space
            orientation={"horizontal"}
            size={8}
            style={{ alignItems: "center" }}
          >
            <FileTextOutlined />
            <Typography.Text
              style={{ fontSize: "12px", fontFamily: "monospace" }}
            >
              {stream.Language}
            </Typography.Text>
            {titleExtra && ["-", titleExtra]}
          </Space>
        ),
        key: `audioStream-${index}`,
        children: (
          <>
            <Row>
              {metadataLabel("Language")}
              {metadataValue(stream.Language)}
              {metadataLabel("Language Code")}
              {metadataValue(stream.LanguageCode)}
              {metadataLabel("Track")}
              {metadataValue(stream.TrackNumber)}
            </Row>
            <Row>
              {metadataLabel("Source")}
              {metadataValue(stream.Source)}
              {metadataLabel("Source Name")}
              {metadataValue(stream.SourceName)}
              {metadataLabel("Format")}
              {metadataValue(stream.Format)}
            </Row>
            <Row style={{ marginTop: 8, borderBottom: "1px solid #efefef" }}>
              <Col span={4}>
                <Typography.Text
                  strong={true}
                  style={{
                    display: "flex",
                    justifyContent: "end",
                    marginRight: 8,
                  }}
                >
                  Attributes
                </Typography.Text>
              </Col>
            </Row>
            <Row>
              {metadataLabel("4:3 Ratio", 4)}
              {metadataValue(stream.Attributes["4By3"] ? enabled : disabled, 1)}
              {metadataLabel("Children", 4)}
              {metadataValue(
                stream.Attributes.Children ? enabled : disabled,
                1,
              )}
              {metadataLabel("Closed Caption", 4)}
              {metadataValue(stream.Attributes.Default ? enabled : disabled, 1)}
              {metadataLabel("ClosedCaption", 4)}
              {metadataValue(
                stream.Attributes.ClosedCaption ? enabled : disabled,
                1,
              )}
            </Row>
            <Row>
              {metadataLabel("Default", 4)}
              {metadataValue(stream.Attributes.Default ? enabled : disabled, 1)}
              {metadataLabel("Forced", 4)}
              {metadataValue(stream.Attributes.Forced ? enabled : disabled, 1)}
              {metadataLabel("Large", 4)}
              {metadataValue(stream.Attributes.Large ? enabled : disabled, 1)}
              {metadataLabel("Letterbox", 4)}
              {metadataValue(
                stream.Attributes.Letterbox ? enabled : disabled,
                1,
              )}
            </Row>
            <Row>
              {metadataLabel("Normal", 4)}
              {metadataValue(stream.Attributes.Normal ? enabled : disabled, 1)}
              {metadataLabel("Panoramic Scan", 4)}
              {metadataValue(stream.Attributes.PanScan ? enabled : disabled, 1)}
              {metadataLabel("Wide", 4)}
              {metadataValue(stream.Attributes.Wide ? enabled : disabled, 1)}
            </Row>
          </>
        ),
      };
    });
    chapters = (title.ChapterList ?? []).map((chapter, index) => {
      return {
        label: chapter.Name || "Unknown",
        key: `chapter-${index}`,
        children: (
          <Row>
            {metadataLabel("Duration")}
            {metadataValue(
              `${String(chapter.Duration.Hours).padStart(2, "0")}:${String(
                chapter.Duration.Minutes,
              ).padStart(2, "0")}:${String(chapter.Duration.Seconds).padStart(
                2,
                "0",
              )}`,
            )}
            {metadataLabel("Ticks")}
            {metadataValue(chapter.Duration.Ticks)}
          </Row>
        ),
      };
    });

    content = (
      <Space orientation={"vertical"} size={0} style={{ width: "100%" }}>
        <Space
          orientation={"horizontal"}
          size={8}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Typography.Title level={5}>Format</Typography.Title>
          {formatSelector}
        </Space>
        <Row>
          {metadataLabel("Name")}
          {metadataValue(title.Container, 20)}
        </Row>
        <Row>
          {metadataLabel("Type")}
          {metadataValue(title.Name, 20)}
        </Row>
        <Row>
          {metadataLabel("Path")}
          {metadataValue(title.Path, 20)}
        </Row>
        {tagsSection({
          Index: `${title.Index}`,
          Playlist: `${title.Playlist}`,
          Type: `${title.Type}`,
          VideoCodec: title.VideoCodec,
          InterlaceDetected: `${title.InterlaceDetected}`,
          KeepDuplicateTitles: `${title.KeepDuplicateTitles}`,
          ...title.Metadata,
        })}
        <Row>
          <Typography.Title
            level={5}
            style={{ fontSize: "14px", marginTop: 8 }}
          >
            Geometry
          </Typography.Title>
        </Row>
        <Row>
          {metadataLabel("Width")}
          {metadataValue(title.Geometry.Width)}
          {metadataLabel("Height")}
          {metadataValue(title.Geometry.Height)}
          {metadataLabel("Ratio")}
          {metadataValue(`${title.Geometry.PAR.Num}:${title.Geometry.PAR.Den}`)}
        </Row>
        <Row>
          {metadataLabel("Crop")}
          {metadataValue(title.Crop)}
        </Row>
        <Row>
          <Typography.Title
            level={5}
            style={{ fontSize: "14px", marginTop: 8 }}
          >
            Timing
          </Typography.Title>
        </Row>
        <Row>
          {metadataLabel("Start Time")}
          {metadataValue(0)}
          {metadataLabel("Duration")}
          {metadataValue(
            `${String(title.Duration.Hours).padStart(2, "0")}:${String(
              title.Duration.Minutes,
            ).padStart(2, "0")}:${String(title.Duration.Seconds).padStart(
              2,
              "0",
            )}`,
          )}
          {metadataLabel("Ticks")}
          {metadataValue(title.Duration.Ticks)}
        </Row>
        <Row>
          {metadataLabel("Framerate")}
          {metadataValue(`${title.FrameRate.Num}/${title.FrameRate.Den}`)}
        </Row>
        <Row>
          <Typography.Title
            level={5}
            style={{ fontSize: "14px", marginTop: 8 }}
          >
            Color
          </Typography.Title>
        </Row>
        <Row>
          {metadataLabel("Bit Depth")}
          {metadataValue(title.Color.BitDepth)}
          {metadataLabel("Chroma Location")}
          {metadataValue(title.Color.ChromaLocation)}
          {metadataLabel("Chroma Sub Sampling")}
          {metadataValue(title.Color.ChromaSubsampling)}
        </Row>
        <Row>
          {metadataLabel("Format")}
          {metadataValue(title.Color.Format)}
          {metadataLabel("Matrix")}
          {metadataValue(title.Color.Matrix)}
          {metadataLabel("Primary")}
          {metadataValue(title.Color.Primary)}
        </Row>
        <Row>
          {metadataLabel("Range")}
          {metadataValue(title.Color.Range)}
          {metadataLabel("Transfer")}
          {metadataValue(title.Color.Transfer)}
        </Row>
        {audioStreams.length > 0 && (
          <>
            <Typography.Title level={5}>Audio Streams</Typography.Title>
            <Collapse
              items={audioStreams}
              expandIcon={({ isActive }) => (
                <CaretRightOutlined rotate={isActive ? 90 : 0} />
              )}
              ghost={true}
              style={{ marginBottom: 16 }}
            />
          </>
        )}
        {subtitleStreams.length > 0 && (
          <>
            <Typography.Title level={5}>Subtitles</Typography.Title>
            <Collapse
              items={subtitleStreams}
              expandIcon={({ isActive }) => (
                <CaretRightOutlined rotate={isActive ? 90 : 0} />
              )}
              ghost={true}
              style={{ marginBottom: 16 }}
            />
          </>
        )}
        {chapters.length > 0 && (
          <>
            <Typography.Title level={5}>Chapters</Typography.Title>
            <Collapse
              items={chapters}
              expandIcon={({ isActive }) => (
                <CaretRightOutlined rotate={isActive ? 90 : 0} />
              )}
              ghost={true}
              style={{ marginBottom: 16 }}
            />
          </>
        )}
      </Space>
    );
  }

  return (
    <Space
      orientation={"vertical"}
      size={8}
      style={{
        width: "100%",
        padding: 16,
        paddingTop: 0,
      }}
      styles={{ item: { width: "100%" } }}
    >
      {content}
    </Space>
  );
};
export default MediaAssetHandbrakeDetails;
