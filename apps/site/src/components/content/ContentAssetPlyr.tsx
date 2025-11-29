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
import React, { useCallback } from "react";
import contentApi from "../../api/contentApi";
import ContentAssetThumbnailGrid from "./ContentAssetThumbnailGrid";

export interface ContentAssetPlyrProps {
  asset: ContentAsset;
  ratioAdjustment: number;
  thumbsGenerated: boolean;
  hlsEnabled: boolean;
}

export const ContentAssetPlyr: React.FunctionComponent<
  ContentAssetPlyrProps
> = ({
  asset,
  ratioAdjustment,
  thumbsGenerated,
  hlsEnabled,
}: ContentAssetPlyrProps) => {
  let playerInstance: Plyr | undefined = undefined;

  const playerRef = useCallback((ref: APITypes) => {
    const player = ref?.plyr;
    playerInstance = player;

    if (hlsEnabled && player) {
      const hls = new Hls();
      hls.loadSource(
        `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/playlist.m3u8`,
      );
      hls.attachMedia(player as unknown as HTMLVideoElement);
    }
  }, []);

  const ssr = typeof window === "undefined" || !document;
  const actionRequired = !(thumbsGenerated && hlsEnabled);

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
  } else {
    options.previewThumbnails = undefined;
  }

  if (!hlsEnabled) {
    source.sources = [
      {
        src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/asset.mp4?start=0`,
        type: "video/mp4",
      },
    ];
  }

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
            width: asset.width * ratioAdjustment + 32,
            alignItems: "start",
          }}
        >
          <Space
            style={{
              margin: 16,
              backgroundColor: "#142737",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: Math.floor(ratioAdjustment * asset.width),
                height: Math.floor(ratioAdjustment * asset.height),
                display: "#000000",
              }}
            >
              {!ssr && asset && (
                <Plyr ref={playerRef} source={source} options={options} />
              )}
            </div>
          </Space>
        </Space>
        <Space direction={"vertical"} style={{ marginTop: 16 }}>
          <ContentAssetThumbnailGrid
            asset={asset}
            seek={(seconds: number) => {
              if (playerInstance) {
                playerInstance.currentTime = seconds;
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
