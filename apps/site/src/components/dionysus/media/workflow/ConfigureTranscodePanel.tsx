import { CheckOutlined } from "@ant-design/icons";
import type {
  DecoratedMediaAssetWorkflow,
  MediaAssetWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Card, Empty, Result, Radio, Space, Typography } from "antd";
import axios from "axios";
import { iso6392 } from "iso-639-2";
import dynamic from "next/dynamic";
import React, { type ReactNode, useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import mediaApi from "../../../../api/mediaApi";
import { useFetch } from "../../../../hooks/useFetch";
import { DIONYSUS_CDN_HOST } from "../../../../utils/constants";
import LoadingWrapper from "../../../common/LoadingWrapper";
import SearchResultTag from "../SearchResultTag";
import { v4 as uuidv4 } from "uuid";
const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });

export interface ConfigureTranscodePanelProps {
  workflow: DecoratedMediaAssetWorkflow;
}

const ConfigureTranscodePanel: React.FunctionComponent<
  ConfigureTranscodePanelProps
> = ({ workflow }: ConfigureTranscodePanelProps) => {
  const [step, setStep] = useState<MediaAssetWorkflowStep | undefined>(
    undefined,
  );
  const [videoTrack, setVideoTrack] = useState(1);
  const [audioTrack, setAudioTrack] = useState(1);
  const [subtitleTrack, setSubtitleTrack] = useState<number | undefined>(
    undefined,
  );
  const [metadataSource, setMetadataSource] = useState<
    "config" | "raw" | "job"
  >("config");

  const [mediaMetadata, mediaMetaLoading, mediaMetaError] = useFetch<
    undefined,
    any
  >({
    dataType: undefined,
    params: undefined,
    watch: [workflow.id],
    fetchFunction: async () => {
      const response = await axios.get(
        `${DIONYSUS_CDN_HOST}/workflow/${workflow.id}/handbrakeMetadata.json`,
        {
          validateStatus: (status) => status === 200 || status === 404,
        },
      );

      if (response.status === 404) {
        return undefined;
      }

      return response.data;
    },
  });

  const [
    transcodeJobConfig,
    transcodeJobConfigLoading,
    transcodeJobConfigError,
  ] = useFetch<undefined, any>({
    dataType: undefined,
    params: undefined,
    watch: [workflow.id],
    fetchFunction: async () => {
      const response = await axios.get(
        `${DIONYSUS_CDN_HOST}/workflow/${workflow.id}/transcodeJob.json`,
        {
          validateStatus: (status) => status === 200 || status === 404,
        },
      );

      if (response.status === 404) {
        return undefined;
      }

      return response.data;
    },
  });

  const [mediaTracks, mediaTracksLoading, mediaTracksError] = useFetch<
    MediaAssetWorkflowStep | undefined,
    any
  >({
    dataType: undefined,
    params: step,
    watch: [step?.id],
    validateOptions: (o) => {
      return (
        o !== undefined && (o.status === "success" || o.status === "pending")
      );
    },
    fetchFunction: async () => {
      const response = await axios.get(
        `${DIONYSUS_CDN_HOST}/workflow/${workflow.id}/transcodeMetadata.json`,
        {
          validateStatus: (status) => status === 200 || status === 404,
        },
      );

      if (response.status === 404) {
        return undefined;
      }

      return response.data;
    },
  });

  useEffect(() => {
    workflow.steps.forEach((current) => {
      if (current.type === "configure_transcode") {
        setStep(current);
        return;
      }
    });
  }, [workflow]);

  useEffect(() => {
    if (mediaTracks) {
      setVideoTrack(mediaTracks.videoTrackIndex);
      setAudioTrack(mediaTracks.audioTrackIndex);
      setSubtitleTrack(mediaTracks.subtitleTrackIndex);
    }
  }, [mediaTracks]);

  let content = <Empty description={"Original metadata not found"} />;
  let statusContent = <></>;

  if (mediaMetadata) {
    const title = mediaMetadata.TitleList[mediaMetadata.MainFeature];
    const videoTracks = [title];
    const audioTracks: any[] = title.AudioList;
    const subtitleTracks: any[] = title.SubtitleList;

    const step = workflow.steps.find(
      (step) => step.type === "configure_transcode",
    );

    if (step?.status === "pending") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"warning"}
          title="Transcode Pending"
          subTitle="Please select the desired video, audio, and subtitle streams to use for transcoding."
        >
          <Button
            block={true}
            type={"primary"}
            disabled={videoTrack === undefined || audioTrack === undefined}
            onClick={async () => {
              const updatedStep =
                await mediaApi.approveMediaAssetTranscodeConfiguration(
                  workflow.id,
                  step.id,
                  {
                    videoTrackIndex: videoTrack,
                    audioTrackIndex: audioTrack,
                    subtitleTrackIndex: subtitleTrack,
                    verificationRequired: true,
                    originalAssetExtension: "mkv",
                  },
                );

              setStep(updatedStep.data.step);
            }}
          >
            Start Transcode
          </Button>
        </Result>
      );
    } else if (step?.status === "success") {
      statusContent = (
        <Result
          style={{ padding: 0, marginBottom: 16 }}
          status={"success"}
          title="Transcode Configuration Saved"
          subTitle="The transcode configuration has been successfully set."
        />
      );
    }

    if (metadataSource === "raw") {
      if (mediaTracks) {
        content = (
          <LoadingWrapper loading={mediaMetaLoading} error={mediaMetaError}>
            <DynamicReactJson
              style={{
                marginLeft: 24,
                fontSize: 10,
              }}
              src={mediaTracks || {}}
              indentWidth={2}
              iconStyle={"square"}
              displayDataTypes={false}
              enableClipboard={true}
            />
          </LoadingWrapper>
        );
      }
    } else if (metadataSource === "job") {
      if (mediaTracks) {
        content = (
          <LoadingWrapper
            loading={transcodeJobConfigLoading}
            error={transcodeJobConfigError}
          >
            <DynamicReactJson
              style={{
                marginLeft: 24,
                fontSize: 10,
              }}
              src={transcodeJobConfig || {}}
              indentWidth={2}
              iconStyle={"square"}
              displayDataTypes={false}
              enableClipboard={true}
            />
          </LoadingWrapper>
        );
      }
    } else if (metadataSource === "config") {
      content = (
        <>
          <Space orientation={"vertical"} style={{ width: 950, minWidth: 650 }}>
            <Typography.Title level={5}>Video Streams</Typography.Title>
            {videoTracks.length === 0 ? (
              <Empty />
            ) : (
              <Space
                orientation={"vertical"}
                size={4}
                style={{ width: "100%" }}
              >
                {videoTracks.map((track, index) => {
                  let backgroundColor = "#ffffff";
                  let selectColor = "#ffffff";

                  if (track.Index === videoTrack) {
                    backgroundColor = "#27601411";
                    selectColor = "#276014";
                  } else if (step?.status === "success") {
                    backgroundColor = "#f3f3f3";
                    selectColor = "#ffffff";
                  }

                  return (
                    <Card
                      key={uuidv4()}
                      style={{
                        backgroundColor: backgroundColor,
                        cursor:
                          track.Index === videoTrack ||
                          step?.status === "success"
                            ? "default"
                            : "pointer",
                      }}
                      styles={{ body: { padding: 12, width: "100%" } }}
                      onClick={() => {
                        if (step?.status === "pending") {
                          setVideoTrack(track.Index);
                        }
                      }}
                    >
                      <Space orientation={"vertical"} style={{ width: "100%" }}>
                        <Space
                          orientation={"horizontal"}
                          className={"person-fix"}
                          style={{ width: "100%", alignItems: "start" }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: selectColor,
                              borderRadius: 24,
                              border: "2px solid #efefef",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CheckOutlined style={{ fontSize: "10px" }} />
                          </div>
                          <Space
                            orientation={"horizontal"}
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "start",
                            }}
                          >
                            <Typography.Text strong={true}>
                              {track.VideoCodec} - {track.Container}
                            </Typography.Text>
                            {mediaMetadata.MainFeature === index && (
                              <SearchResultTag style={{ padding: "2px 6px" }}>
                                Default
                              </SearchResultTag>
                            )}
                          </Space>
                        </Space>
                        <Space
                          orientation={"vertical"}
                          style={{ marginLeft: 28 }}
                        >
                          <Space orientation={"horizontal"}>
                            <Typography.Text
                              strong={true}
                              style={{ fontSize: 12, textAlign: "right" }}
                            >
                              Dimensions:
                            </Typography.Text>
                            <Typography.Text
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              {track.Geometry.Width}px X {track.Geometry.Height}
                              px
                            </Typography.Text>
                          </Space>
                        </Space>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            )}
          </Space>
          <Space orientation={"vertical"} style={{ width: 950, minWidth: 650 }}>
            <Typography.Title level={5}>Audio Streams</Typography.Title>
            {audioTracks.length === 0 ? (
              <Empty />
            ) : (
              <Space
                orientation={"vertical"}
                size={4}
                style={{ width: "100%" }}
              >
                {audioTracks.map((track) => {
                  let titleExtra: ReactNode = undefined;
                  const audioLanguageCode = track.LanguageCode;
                  const audioTitle = track.Name;

                  if (audioLanguageCode) {
                    const audioLanguage = iso6392.filter(
                      (entry) =>
                        entry.iso6392B === audioLanguageCode ||
                        entry.iso6392T === audioLanguageCode,
                    )[0];

                    if (audioLanguage) {
                      titleExtra = (
                        <Space
                          orientation={"horizontal"}
                          size={4}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Space
                            orientation={"horizontal"}
                            style={{ width: "100%" }}
                          >
                            {audioLanguage.iso6391 ? (
                              <ReactCountryFlag
                                countryCode={audioLanguage.iso6391}
                                cdnUrl={"/flags/"}
                                cdnSuffix={"svg"}
                                svg={true}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              />
                            ) : (
                              "?"
                            )}
                            {audioLanguage && audioLanguage.name}
                            {audioTitle && (
                              <Typography.Text
                                style={{ fontSize: "12px", color: "#666666" }}
                              >
                                ({audioTitle})
                              </Typography.Text>
                            )}
                          </Space>
                        </Space>
                      );
                    }
                  }

                  let backgroundColor = "#ffffff";
                  let selectColor = "#ffffff";

                  if (track.TrackNumber === audioTrack) {
                    backgroundColor = "#27601411";
                    selectColor = "#276014";
                  } else if (step?.status === "success") {
                    backgroundColor = "#f3f3f3";
                    selectColor = "#ffffff";
                  }

                  return (
                    <Card
                      key={uuidv4()}
                      style={{
                        backgroundColor: backgroundColor,
                        cursor:
                          track.TrackNumber === audioTrack ||
                          step?.status === "success"
                            ? "default"
                            : "pointer",
                      }}
                      styles={{ body: { padding: 12, width: "100%" } }}
                      onClick={() => {
                        if (step?.status === "pending") {
                          setAudioTrack(track.TrackNumber);
                        }
                      }}
                    >
                      <Space orientation={"vertical"} style={{ width: "100%" }}>
                        <Space
                          orientation={"horizontal"}
                          className={"person-fix"}
                          style={{ width: "100%", alignItems: "start" }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: selectColor,
                              borderRadius: 24,
                              border: "2px solid #efefef",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CheckOutlined style={{ fontSize: "10px" }} />
                          </div>
                          <Space
                            orientation={"horizontal"}
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "start",
                            }}
                          >
                            <Typography.Text strong={true}>
                              {track.Description}
                            </Typography.Text>
                            {track.Attributes.Default && (
                              <SearchResultTag style={{ padding: "2px 6px" }}>
                                Default
                              </SearchResultTag>
                            )}
                          </Space>
                        </Space>
                        <Space
                          orientation={"vertical"}
                          style={{ width: "100%", marginLeft: 28 }}
                        >
                          {titleExtra}
                        </Space>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            )}
          </Space>
          {subtitleTracks.length > 0 && (
            <Space
              orientation={"vertical"}
              style={{ width: 950, minWidth: 650 }}
            >
              <Typography.Title level={5}>Subtitle Streams</Typography.Title>
              <Space
                orientation={"vertical"}
                size={4}
                style={{ width: "100%" }}
              >
                {subtitleTracks.map((track) => {
                  let titleExtra: ReactNode = undefined;
                  const subtitleLanguageCode = track.LanguageCode;
                  const subtitleTitle = track.Name;

                  if (subtitleLanguageCode) {
                    const subtitleLanguage = iso6392.filter(
                      (entry) =>
                        entry.iso6392B === subtitleLanguageCode ||
                        entry.iso6392T === subtitleLanguageCode,
                    )[0];

                    if (subtitleLanguage) {
                      titleExtra = (
                        <Space
                          orientation={"horizontal"}
                          size={4}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Space
                            orientation={"horizontal"}
                            style={{ width: "100%", alignItems: "center" }}
                          >
                            {subtitleLanguage.iso6391 ? (
                              <ReactCountryFlag
                                countryCode={subtitleLanguage.iso6391}
                                cdnUrl={"/flags/"}
                                cdnSuffix={"svg"}
                                svg={true}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              />
                            ) : (
                              "?"
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
                          <Space orientation="horizontal">
                            {track.Attributes.Default && (
                              <SearchResultTag
                                style={{ padding: "2px 6px" }}
                                color={"#276014"}
                              >
                                Default
                              </SearchResultTag>
                            )}
                            {track.Attributes.Commentary && (
                              <SearchResultTag
                                style={{ padding: "2px 6px" }}
                                color={"#7d0000"}
                              >
                                Commentary
                              </SearchResultTag>
                            )}
                            {track.Attributes.Forced && (
                              <SearchResultTag
                                style={{ padding: "2px 6px" }}
                                color={"#276014"}
                              >
                                Forced
                              </SearchResultTag>
                            )}
                            {track.Attributes.ClosedCaption && (
                              <SearchResultTag style={{ padding: "2px 6px" }}>
                                Hearing Impaired
                              </SearchResultTag>
                            )}
                          </Space>
                        </Space>
                      );
                    }
                  }

                  let backgroundColor = "#ffffff";
                  let selectColor = "#ffffff";

                  if (track.TrackNumber === subtitleTrack) {
                    backgroundColor = "#27601411";
                    selectColor = "#276014";
                  } else if (step?.status === "success") {
                    backgroundColor = "#f3f3f3";
                    selectColor = "#ffffff";
                  }

                  return (
                    <Card
                      key={uuidv4()}
                      styles={{
                        body: { padding: 12, width: "100%" },
                      }}
                      style={{
                        backgroundColor: backgroundColor,
                        cursor:
                          step?.status === "success" ? "default" : "pointer",
                      }}
                      onClick={() => {
                        if (step?.status === "pending") {
                          setSubtitleTrack(
                            track.TrackNumber === subtitleTrack
                              ? undefined
                              : track.TrackNumber,
                          );
                        }
                      }}
                    >
                      <Space orientation={"vertical"} style={{ width: "100%" }}>
                        <Space
                          orientation={"horizontal"}
                          className={"person-fix"}
                          style={{ width: "100%", alignItems: "start" }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: selectColor,
                              borderRadius: 24,
                              border: "2px solid #efefef",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CheckOutlined style={{ fontSize: "10px" }} />
                          </div>
                          <Typography.Text strong={true}>
                            {titleExtra}
                          </Typography.Text>
                        </Space>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </Space>
          )}
        </>
      );
    }
  }

  return (
    <LoadingWrapper loading={mediaMetaLoading} error={mediaMetaError}>
      <Space
        orientation={"vertical"}
        style={{ width: 950, minWidth: 650, marginTop: 16 }}
      >
        {statusContent}
        {step?.status === "success" && (
          <Radio.Group
            defaultValue={"config"}
            block={true}
            onChange={(e) => {
              setMetadataSource(e.target.value);
            }}
            options={[
              {
                label: "Selected Configuration",
                value: "config",
              },
              {
                label: "Raw Configuration",
                value: "raw",
              },
              {
                label: "Transcode Job",
                value: "job",
              },
            ]}
            optionType="button"
            buttonStyle="solid"
            style={{ marginBottom: 32 }}
          />
        )}
        {content}
      </Space>
    </LoadingWrapper>
  );
};
export default ConfigureTranscodePanel;
