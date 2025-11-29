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
import React, { useMemo, useRef, useState } from "react";
import contentApi from "../../api/contentApi";
import ContentAssetThumbnailGrid from "./ContentAssetThumbnailGrid";

export interface ContentAssetPlyrProps {
  asset: ContentAsset;
  ratioAdjustment: number;
}

export const ContentAssetPlyr: React.FunctionComponent<
  ContentAssetPlyrProps
> = ({ asset, ratioAdjustment }: ContentAssetPlyrProps) => {
  const [hlsEnabled, setHlsEnabled] = useState(false);
  const [thumbsGenerated, setThumbnailsGenerated] = useState(false);

  const playerRef = useRef<APITypes>(null);

  const player = useMemo(() => {
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
    };

    const source: PlyrSource = {
      type: "video",
      sources: [],
      poster: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/screenshots/0.png`,
    };

    if (thumbsGenerated) {
      options.previewThumbnails = {
        src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/thumbs.vtt`,
        enabled: true,
      };
    }

    if (!hlsEnabled) {
      source.sources = [
        {
          src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/asset.mp4?start=0`,
          type: "video/mp4",
        },
      ];
    }

    const playerInstance = (
      <Plyr ref={playerRef} source={source} options={options} />
    );

    if (hlsTag) {
      const hls = new Hls();
      hls.loadSource(
        `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/playlist.m3u8`,
      );
      hls.attachMedia(playerInstance as unknown as HTMLVideoElement);
    }

    setThumbnailsGenerated(thumbsTag);
    setHlsEnabled(hlsTag);

    return playerInstance;
  }, [asset]);

  const ssr = typeof window === "undefined" || !document;
  const actionRequired = !(thumbsGenerated && hlsEnabled);

  console.log(ratioAdjustment);

  // 4 rows of thumbnails and 3 grid gaps (no gap at top or bottom
  const containerWidth = asset.width * ratioAdjustment + 32;
  const videoWidth = Math.floor(ratioAdjustment * asset.width);
  const videoHeight = Math.floor(ratioAdjustment * asset.height);
  const thumbnailHeight =
    asset.width > asset.height
      ? (videoHeight - 3 * 8) / 4
      : (videoHeight - 8) / 2;

  return (
    <Space
      direction={"vertical"}
      style={{
        display: "block",
        width: "calc(100vw - 200px)",
      }}
    >
      <Row
        style={{
          background: "#142737",
          display: "flex",
        }}
      >
        <Space
          style={{
            width: containerWidth,
            alignItems: "start",
          }}
        >
          <Space
            size={0}
            style={{
              margin: 16,
              marginRight: 8,
              backgroundColor: "#142737",
              display: "flex",
              justifyContent: "center",
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
        <Space direction={"vertical"} style={{ marginTop: 16 }}>
          <ContentAssetThumbnailGrid
            asset={asset}
            height={thumbnailHeight}
            seek={(seconds: number) => {
              if (playerRef.current?.plyr) {
                playerRef.current.plyr.currentTime = seconds;
              }
            }}
          />
        </Space>
      </Row>
      {actionRequired && (
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
