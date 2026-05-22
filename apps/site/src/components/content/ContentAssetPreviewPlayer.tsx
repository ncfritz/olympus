"use client";

import type { ContentAsset } from "@ncfritz/olympus-sdk/dionysus";
import { Space } from "antd";
import Plyr, { type APITypes } from "plyr-react";
import React, { useMemo, useRef } from "react";
import { CONTENT_CDN_HOST } from "../../utils/constants";

export interface ContentAssetPreviewPlayerProps {
  asset: ContentAsset;
  type: "timelapse" | "sample";
  maxWidth?: number;
  maxHeight?: number;
  playOnHover?: boolean;
  onClick?: () => void;
}

const ContentAssetPreviewPlayer: React.FunctionComponent<
  ContentAssetPreviewPlayerProps
> = ({
  asset,
  type,
  maxWidth = 400,
  maxHeight = 225,
  playOnHover,
  onClick,
}: ContentAssetPreviewPlayerProps) => {
  const ratio = asset.width / asset.height;

  let playerHeight = asset.height > maxHeight ? maxHeight : asset.height;
  let playerWidth = playerHeight * ratio;

  if (playerWidth > maxWidth) {
    playerWidth = maxWidth;
    playerHeight = playerWidth / ratio;
  }

  const playerRef = useRef<APITypes>(null);

  const player = useMemo(() => {
    let controls: string[] = [];

    if (!playOnHover) {
      controls = ["play", "progress", "current-time"];
    }

    return (
      <Plyr
        ref={playerRef}
        source={{
          type: "video",
          sources: [
            {
              src: `${CONTENT_CDN_HOST}/assets/${asset.id}/${type}.mp4`,
              type: "video/mp4",
            },
          ],
        }}
        options={{
          controls: controls,
          muted: true,
          clickToPlay: !playOnHover,
        }}
      />
    );
  }, [asset]);

  let timerRef: ReturnType<typeof setTimeout>;

  return (
    <Space
      direction={"horizontal"}
      style={{
        width: maxWidth,
        height: maxHeight,
        background: "#000000",
        alignContent: "center",
        justifyContent: "center",
        borderRadius: 6,
      }}
      styles={{
        item: {
          width: playerWidth,
          height: playerHeight,
        },
      }}
    >
      <Space
        direction={"horizontal"}
        className={"dionysus-preview"}
        style={{
          width: playerWidth,
          height: playerHeight,
          alignContent: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
        styles={{
          item: {
            width: playerWidth,
            height: playerHeight,
          },
        }}
        onClick={() => {
          if (onClick) {
            onClick();
          }
        }}
        onMouseEnter={() => {
          if (playOnHover) {
            timerRef = setTimeout(() => {
              if (playerRef.current?.plyr) {
                playerRef.current.plyr.play();
              }
            }, 600);
          }
        }}
        onMouseLeave={() => {
          if (playOnHover) {
            if (playerRef.current?.plyr) {
              if (timerRef) {
                clearTimeout(timerRef);
              }

              playerRef.current.plyr.stop();
              playerRef.current.plyr.currentTime = 0;
            }
          }
        }}
      >
        {player}
      </Space>
    </Space>
  );
};
export default React.memo(ContentAssetPreviewPlayer);
