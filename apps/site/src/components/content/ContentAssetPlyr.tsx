"use client";

import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { ContentAsset } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Row, Space, Typography } from "antd";
import Hls from "hls.js";
import Plyr, {
  type APITypes,
  type PlyrOptions,
  type PlyrSource,
} from "plyr-react";
import React, { type CSSProperties, useMemo, useRef, useState } from "react";
import contentApi from "../../api/contentApi";
import { CONTENT_CDN_HOST } from "../../utils/constants";
import ContentAssetThumbnailGrid from "./ContentAssetThumbnailGrid";
import { calculateAssetDimensions } from "./util";

export interface ContentAssetPlyrProps {
  asset: ContentAsset;
  showWarnings?: boolean;
  style?: CSSProperties;
  wrapperStyle?: CSSProperties;
}

export const ContentAssetPlyr: React.FunctionComponent<
  ContentAssetPlyrProps
> = ({
  asset,
  style,
  wrapperStyle,
  showWarnings = true,
}: ContentAssetPlyrProps) => {
  const [hlsEnabled, setHlsEnabled] = useState(false);
  const [thumbsGenerated, setThumbnailsGenerated] = useState(false);
  const [videoWidth, setVideoWidth] = useState(asset.width);
  const [videoHeight, setVideoHeight] = useState(asset.height);
  const [thumbnailHeight, setThumbnailHeight] = useState(125);

  const playerRef = useRef<APITypes>(null);

  const player = useMemo(() => {
    const [width, height, aspectRatio, adjustment] =
      calculateAssetDimensions(asset);
    const thumbHeight =
      asset.width > asset.height ? (height - 3 * 8) / 4 : (height - 8) / 2;

    console.group("Calculated asset dimensions");
    console.log(`asset: ${asset.width} x ${asset.height}`);
    console.log(`aspectRatio: ${aspectRatio}`);
    console.log(`adjustment: ${adjustment}`);
    console.log(`videoWidth: ${width}`);
    console.log(`videoHeight: ${height}`);
    console.log(`thumbnailHeight: ${thumbHeight}`);
    console.groupEnd();

    setVideoWidth(width);
    setVideoHeight(height);
    setThumbnailHeight(thumbHeight);

    let hlsTag = false;
    let thumbsTag = false;

    for (const tag of asset.tags) {
      if (tag.type === "system" && tag.name === "video.hls") {
        hlsTag = true;
      } else if (tag.type === "system" && tag.name === "video.thumbs") {
        thumbsTag = true;
      }
    }

    const options: PlyrOptions = {
      controls: ["play", "progress", "current-time", "volume", "mute"],
      muted: true,
      clickToPlay: true,
      ratio: `${width}:${height}`,
    };

    const source: PlyrSource = {
      type: "video",
      sources: [],
      poster: `${CONTENT_CDN_HOST}/assets/${asset.id}/screenshots/0.png`,
    };

    if (thumbsGenerated) {
      options.previewThumbnails = {
        src: `${CONTENT_CDN_HOST}/assets/${asset.id}/thumbs.vtt`,
        enabled: true,
      };
    }

    if (!hlsEnabled) {
      source.sources = [
        {
          src: `${CONTENT_CDN_HOST}/assets/${asset.id}/asset.mp4?start=0`,
          type: "video/mp4",
        },
      ];
    }

    const playerInstance = (
      <Plyr ref={playerRef} source={source} options={options} />
    );

    if (hlsTag) {
      const hls = new Hls();
      hls.loadSource(`${CONTENT_CDN_HOST}/assets/${asset.id}/playlist.m3u8`);
      hls.attachMedia(playerInstance as unknown as HTMLVideoElement);
    }

    setThumbnailsGenerated(thumbsTag);
    setHlsEnabled(hlsTag);

    return playerInstance;
  }, [asset]);

  const ssr = typeof window === "undefined" || !document;
  const actionRequired = !(thumbsGenerated && hlsEnabled);

  return (
    <Space
      direction={"vertical"}
      style={{
        display: "block",
        ...style,
      }}
    >
      <Row
        style={{
          ...wrapperStyle,
          display: "flex",
        }}
      >
        <Space
          style={{
            width: videoWidth,
            alignItems: "start",
            marginRight: 16,
            borderRadius: 6,
          }}
        >
          <Space
            size={0}
            style={{
              backgroundColor: "#142737",
              display: "flex",
              justifyContent: "center",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                width: videoWidth,
                height: videoHeight,
                display: "#000000",
              }}
            >
              {!ssr && asset && player}
            </div>
          </Space>
        </Space>
        <Space orientation={"vertical"}>
          <ContentAssetThumbnailGrid
            asset={asset}
            height={thumbnailHeight}
            onSelect={(i: number) => {
              const seconds = Math.ceil(((i / 16) * asset.durationMs) / 1000);

              if (playerRef.current?.plyr) {
                playerRef.current.plyr.currentTime = seconds;
              }
            }}
          />
        </Space>
      </Row>
      {actionRequired && showWarnings && (
        <Row style={{ padding: 16, background: "#ffcc33" }}>
          <Space size={16} direction={"horizontal"}>
            <Space
              size={8}
              direction={"horizontal"}
              style={{ borderRight: "1px solid #ccaa00", paddingRight: 16 }}
            >
              <Typography.Text style={{ color: "#333333", fontSize: "12px" }}>
                HTTP Live Streaming
              </Typography.Text>
              {hlsEnabled ? (
                <Space size={8}>
                  <CheckCircleOutlined
                    style={{ fontSize: "14px", color: "#00CC00" }}
                  />
                  <Typography.Text
                    style={{ fontSize: "14px", color: "00CC00" }}
                  >
                    Enabled
                  </Typography.Text>
                </Space>
              ) : (
                <Space size={16} direction={"horizontal"}>
                  <Space size={8}>
                    <CloseCircleOutlined
                      style={{ fontSize: "14px", color: "#cc0000" }}
                    />
                    <Typography.Text
                      style={{ fontSize: "14px", color: "#cc0000" }}
                    >
                      Disabled
                    </Typography.Text>
                  </Space>
                  <Button
                    ghost={true}
                    size={"small"}
                    onClick={async () => {
                      await contentApi.queueContentTask(asset.id, "hls");
                    }}
                  >
                    Enable
                  </Button>
                </Space>
              )}
            </Space>
          </Space>
          <Space size={16} direction={"horizontal"} style={{ paddingLeft: 16 }}>
            <Space size={8} direction={"horizontal"}>
              <Typography.Text style={{ color: "#333333", fontSize: "12px" }}>
                Thumbnails
              </Typography.Text>
              {thumbsGenerated ? (
                <Space size={8}>
                  <CheckCircleOutlined
                    style={{ fontSize: "14px", color: "#00CC00" }}
                  />
                  <Typography.Text
                    style={{ fontSize: "14px", color: "00CC00" }}
                  >
                    Generated
                  </Typography.Text>
                </Space>
              ) : (
                <Space size={16} direction={"horizontal"}>
                  <Space size={8}>
                    <CloseCircleOutlined
                      style={{ fontSize: "14px", color: "#cc0000" }}
                    />
                    <Typography.Text
                      style={{ fontSize: "14px", color: "#cc0000" }}
                    >
                      Missing
                    </Typography.Text>
                  </Space>
                  <Button
                    ghost={true}
                    size={"small"}
                    onClick={async () => {
                      await contentApi.queueContentTask(asset.id, "thumbnail");
                    }}
                  >
                    Generate
                  </Button>
                </Space>
              )}
            </Space>
          </Space>
        </Row>
      )}
    </Space>
  );
};
export default ContentAssetPlyr;
