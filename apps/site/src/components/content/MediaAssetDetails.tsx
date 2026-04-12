import {
  CaretRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  FileTextOutlined,
  FileUnknownOutlined,
  SoundOutlined,
  VideoCameraOutlined
} from "@ant-design/icons";
import { co } from "@fullcalendar/core/internal-common";
import {
  Col,
  Collapse,
  type CollapseProps,
  Row,
  Space,
  Typography,
} from "antd";
import { iso6392 } from "iso-639-2";
import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import ReactCountryFlag from "react-country-flag/src";
const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });

export interface MediaAssetDetailsProps {
  metadata: any;
  showRaw: boolean;
}

const metadataLabel = (label: string, span = 4) => {
  return (
    <Col span={span}>
      <Typography.Text
        style={{
          fontSize: "12px",
          display: "flex",
          justifyContent: "end",
          marginRight: 8,
        }}
        strong={true}
      >
        {label}:
      </Typography.Text>
    </Col>
  );
};

const metadataValue = (value: ReactNode, span = 4) => {
  return (
    <Col span={span}>
      <Typography.Text style={{ fontSize: "12px", fontFamily: "monospace" }}>
        {value}
      </Typography.Text>
    </Col>
  );
};

const tagsSection = (tags: Record<string, string>) => {
  const rows: ReactNode[] = [];
  const tagsContent: ReactNode[] = [];

  if (tags) {
    Object.entries(tags).forEach(([key, value]) => {
      tagsContent.push(
        <Col span={24}>
          <Row style={{ margin: 2 }} align={"middle"}>
            <Col
              span={6}
              style={{
                backgroundColor: "#efefef",
                display: "flex",
                paddingRight: 4,
                borderTopLeftRadius: 8,
                borderBottomLeftRadius: 8,
                justifyContent: "end",
              }}
            >
              <Typography.Text
                strong={true}
                style={{ fontSize: "11px", padding: 4, alignItems: "end" }}
              >
                {key}
              </Typography.Text>
            </Col>
            <Col
              span={18}
              style={{
                backgroundColor: "#f9f9f9",
                borderTopRightRadius: 8,
                borderBottomRightRadius: 8,
                paddingLeft: 4,
              }}
            >
              <Typography.Text
                style={{ fontSize: "11px", fontFamily: "monospace" }}
              >
                {value}
              </Typography.Text>
            </Col>
          </Row>
        </Col>,
      );
    });

    rows.push(
      <Row style={{ marginTop: 8 }}>
        <Col
          span={4}
          style={{
            alignSelf: "start",
          }}
        >
          <Typography.Text
            strong={true}
            style={{ display: "flex", justifyContent: "end", marginRight: 8 }}
          >
            Tags
          </Typography.Text>
        </Col>
        <Col span={20}>
          <Row gutter={8}>{tagsContent}</Row>
        </Col>
      </Row>,
    );
  }

  return rows;
};

const enabled = (
  <Typography.Text style={{ color: "#006600" }}>
    <CheckCircleFilled />
  </Typography.Text>
);
const disabled = (
  <Typography.Text style={{ color: "#990000" }}>
    <CloseCircleFilled />
  </Typography.Text>
);

const MediaAssetDetails: React.FunctionComponent<MediaAssetDetailsProps> = ({
  metadata,
  showRaw,
}: MediaAssetDetailsProps) => {
  let content;

  if (showRaw) {
    content = (
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
    );
  } else {
    const streams: CollapseProps["items"] = [];
    const chapters: CollapseProps["items"] = [];

    // @ts-expect-error No types for FFMpeg probe data
    metadata.streams?.forEach((stream) => {
      const rows: ReactNode[] = [];

      rows.push(
        <Row align={"middle"}>
          {metadataLabel("Codec Name")}
          {metadataValue(stream.codec_name)}
          {metadataLabel("Codec Type")}
          {metadataValue(stream.codec_type)}
          {metadataLabel("Profile")}
          {metadataValue(stream.profile)}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Codec Tag")}
          {metadataValue(stream.codec_tag_string)}
          {metadataLabel("Codec Tag (raw)")}
          {metadataValue(stream.codec_tag)}
          {metadataLabel("Extradata Size")}
          {metadataValue(stream.extradata_size)}
        </Row>,
      );

      const extraDisposition: ReactNode[] = [];

      if (stream.codec_type === "video") {
        extraDisposition.push(
          metadataLabel("CC", 4),
          metadataValue(stream.closed_captions === 0 ? disabled : enabled, 1),
          metadataLabel("Film Grain", 4),
          metadataValue(stream.film_grain === 0 ? disabled : enabled, 1),
        );

        rows.push(
          <Row align={"middle"}>
            {metadataLabel("Width")}
            {metadataValue(`${stream.width}px`)}
            {metadataLabel("Height")}
            {metadataValue(`${stream.height}px`)}
            {metadataLabel("Sample Ratio")}
            {metadataValue(stream.sample_aspect_ratio)}
          </Row>,
          <Row align={"middle"}>
            {metadataLabel("Width (Coded)")}
            {metadataValue(`${stream.coded_width}px`)}
            {metadataLabel("Height (Coded")}
            {metadataValue(`${stream.coded_height}px`)}
            {metadataLabel("Display Ratio")}
            {metadataValue(stream.display_aspect_ratio)}
          </Row>,
          <Row align={"middle"}>
            {metadataLabel("B-Frames")}
            {metadataValue(stream.has_b_frames)}
            {metadataLabel("Pixel Format")}
            {metadataValue(stream.pix_fmt)}
            {metadataLabel("Level")}
            {metadataValue(stream.level)}
          </Row>,
          <Row align={"middle"}>
            {metadataLabel("Refs")}
            {metadataValue(stream.refs)}
            {metadataLabel("AVC")}
            {metadataValue(stream.is_avc)}
            {metadataLabel("NAL Length")}
            {metadataValue(stream.nal_length_size)}
          </Row>,
          <Row align={"middle"}>
            {metadataLabel("Color Range")}
            {metadataValue(stream.color_range)}
            {metadataLabel("Color Space")}
            {metadataValue(stream.color_space)}
            {metadataLabel("Color Transfer")}
            {metadataValue(stream.color_transfer)}
          </Row>,
          <Row align={"middle"}>
            {metadataLabel("Color Primaries")}
            {metadataValue(stream.color_primaries)}
            {metadataLabel("Chroma Location")}
            {metadataValue(stream.chroma_location)}
            {metadataLabel("Field Order")}
            {metadataValue(stream.field_order)}
          </Row>,
        );
      }

      if (stream.codec_type === "audio") {
        rows.push(
          <Row align={"middle"}>
            {metadataLabel("Sample Format")}
            {metadataValue(stream.sample_fmt)}
            {metadataLabel("Sample Rate")}
            {metadataValue(stream.sample_rate)}
            {metadataLabel("Channels")}
            {metadataValue(stream.channels)}
          </Row>,
          <Row align={"middle"}>
            {metadataLabel("Sample Layout")}
            {metadataValue(stream.channel_layout)}
            {metadataLabel("Bits/Sample")}
            {metadataValue(stream.bits_per_sample)}
          </Row>,
        );
      }

      rows.push(
        <Row align={"middle"}>
          {metadataLabel("ID")}
          {metadataValue(stream.id)}
          {metadataLabel("R Frame Rate")}
          {metadataValue(stream.r_frame_rate)}
          {metadataLabel("Avg Frame Rate")}
          {metadataValue(stream.avg_frame_rate)}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Time Base")}
          {metadataValue(stream.time_base)}
          {metadataLabel("Start TS")}
          {metadataValue(stream.start_pts)}
          {metadataLabel("Start Time")}
          {metadataValue(stream.start_time)}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Duration TS")}
          {metadataValue(stream.duration_ts)}
          {metadataLabel("Duration")}
          {metadataValue(stream.duration)}
          {metadataLabel("Bit Rate")}
          {metadataValue(stream.bit_rate)}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Bit Rate (max)")}
          {metadataValue(stream.max_bit_rate)}
          {metadataLabel("Bits/Sample")}
          {metadataValue(stream.bits_per_raw_sample)}
        </Row>,
      );

      rows.push(
        tagsSection(stream.tags),
        <Row style={{ marginTop: 8, borderBottom: "1px solid #efefef" }}>
          <Col span={4}>
            <Typography.Text
              strong={true}
              style={{ display: "flex", justifyContent: "end", marginRight: 8 }}
            >
              Disposition
            </Typography.Text>
          </Col>
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Default", 4)}
          {metadataValue(
            stream.disposition.default === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Dubbed", 4)}
          {metadataValue(stream.disposition.dub === 0 ? disabled : enabled, 1)}
          {metadataLabel("Original", 4)}
          {metadataValue(
            stream.disposition.original === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Comment", 4)}
          {metadataValue(
            stream.disposition.comment === 0 ? disabled : enabled,
            1,
          )}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Lyrics", 4)}
          {metadataValue(
            stream.disposition.lyrics === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Karaoke", 4)}
          {metadataValue(
            stream.disposition.karaoke === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Forced", 4)}
          {metadataValue(
            stream.disposition.forced === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Hearing Impaired", 4)}
          {metadataValue(
            stream.disposition.hearing_impaired === 0 ? disabled : enabled,
            1,
          )}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Visual Impaired", 4)}
          {metadataValue(
            stream.disposition.visual_impaired === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Clean Effects", 4)}
          {metadataValue(
            stream.disposition.clean_effects === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Attached Pic", 4)}
          {metadataValue(
            stream.disposition.attached_pic === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Timed Thumbs", 4)}
          {metadataValue(
            stream.disposition.timed_thumbnails === 0 ? disabled : enabled,
            1,
          )}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Captions", 4)}
          {metadataValue(
            stream.disposition.captions === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Descriptions", 4)}
          {metadataValue(
            stream.disposition.descriptions === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Metadata", 4)}
          {metadataValue(
            stream.disposition.metadata === 0 ? disabled : enabled,
            1,
          )}
          {metadataLabel("Dependent", 4)}
          {metadataValue(
            stream.disposition.dependent === 0 ? disabled : enabled,
            1,
          )}
        </Row>,
        <Row align={"middle"}>
          {metadataLabel("Still Image", 4)}
          {metadataValue(
            stream.disposition.still_image === 0 ? disabled : enabled,
            1,
          )}
          {extraDisposition}
        </Row>,
      );

      let titleIcon = <FileUnknownOutlined />;
      let titleExtra: ReactNode = undefined;

      if (stream.codec_type === "video") {
        titleIcon = <VideoCameraOutlined />;
      } else if (stream.codec_type === "audio") {
        titleIcon = <SoundOutlined />;
      } else if (stream.codec_type === "subtitle") {
        titleIcon = <FileTextOutlined />;

        const subtitleLanguageCode = stream.tags?.language;
        const subtitleTitle = stream.tags?.title;

        if (subtitleLanguageCode) {
          const subtitleLanguage = iso6392.filter(
            (entry) => entry.iso6392B === subtitleLanguageCode,
          )[0];

          if (subtitleLanguage) {
            titleExtra = (
              <Space direction={"horizontal"} size={4}>
                {subtitleLanguage.iso6391 ? (
                  <ReactCountryFlag
                    countryCode={subtitleLanguage.iso6391}
                    cdnUrl={"/flags/"}
                    cdnSuffix={"svg"}
                    svg={true}
                  />
                ) : (
                  "huh"
                )}
                {subtitleLanguage && subtitleLanguage.name}
                {subtitleTitle && (
                  <Typography.Text
                    style={{ fontSize: "12px", color: "#666666" }}
                  >
                    ({subtitleTitle})
                  </Typography.Text>
                )}
              </Space>
            );
          }
        }
      }

      streams.push({
        label: (
          <Space
            direction={"horizontal"}
            size={8}
            style={{ alignItems: "center" }}
          >
            {titleIcon}
            <Typography.Text
              style={{ fontSize: "12px", fontFamily: "monospace" }}
            >
              {stream.codec_long_name}
            </Typography.Text>
            {titleExtra && ["-", titleExtra]}
          </Space>
        ),
        key: `stream-${stream.index}`,
        children: (
          <Space
            direction={"vertical"}
            size={4}
            style={{ width: "100%", marginBottom: 16 }}
          >
            {rows}
          </Space>
        ),
      });
    });

    content = (
      <Space direction={"vertical"} size={0} style={{ width: "100%" }}>
        <Typography.Title level={5}>Format</Typography.Title>
        <Row>
          {metadataLabel("Name")}
          {metadataValue(metadata.format.format_name, 20)}
        </Row>
        <Row>
          {metadataLabel("Long Name")}
          {metadataValue(metadata.format.format_long_name, 20)}
        </Row>
        <Row>
          {metadataLabel("Start Time")}
          {metadataValue(metadata.format.start_time)}
          {metadataLabel("Duration")}
          {metadataValue(metadata.format.duration)}
          {metadataLabel("Size")}
          {metadataValue(metadata.format.size)}
        </Row>
        <Row>
          {metadataLabel("Stream Count")}
          {metadataValue(metadata.format.nb_streams)}
          {metadataLabel("Stream Groups")}
          {metadataValue(metadata.format.nb_stream_groups)}
          {metadataLabel("BitRate")}
          {metadataValue(metadata.format.bit_rate)}
        </Row>
        <Row>
          {metadataLabel("Programs Count")}
          {metadataValue(metadata.format.nb_programs)}
        </Row>
        {tagsSection(metadata.format.tags)}
        {streams.length > 0 && (
          <>
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Streams
            </Typography.Title>
            <Collapse
              items={streams}
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
      direction={"vertical"}
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
export default MediaAssetDetails;
