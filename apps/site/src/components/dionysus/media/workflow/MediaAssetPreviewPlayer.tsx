"use client";

import { Space } from "antd";
import Plyr, { type APITypes } from "plyr-react";
import React, { useMemo, useRef } from "react";

export interface MediaAssetPreviewPlayerProps {
  workflowId: string;
  sampleIndex: number;
  maxWidth?: number;
}

const MediaAssetPreviewPlayer: React.FunctionComponent<
  MediaAssetPreviewPlayerProps
> = ({
  workflowId,
  sampleIndex,
  maxWidth = 400,
}: MediaAssetPreviewPlayerProps) => {
  const playerRef = useRef<APITypes>(null);

  const player = useMemo(() => {
    const controls: string[] = [
      "play",
      "progress",
      "current-time",
      "mute",
      "volume",
    ];

    const playerInstance = (
      <Plyr
        ref={playerRef}
        source={{
          type: "video",
          sources: [
            {
              src: `https://dionysus-cdn.dev.ncfritz.net/workflow/${workflowId}/sample${sampleIndex}.mp4`,
              type: "video/mp4",
            },
          ],
        }}
        options={{
          controls: controls,
          muted: false,
          clickToPlay: true,
        }}
      />
    );

    return playerInstance;
  }, []);

  return (
    <Space
      direction={"horizontal"}
      className={"dionysus-preview"}
      style={{
        width: maxWidth,
        alignContent: "center",
        justifyContent: "center",
        borderRadius: 6,
      }}
      styles={{
        item: {
          width: maxWidth,
        },
      }}
    >
      {player}
    </Space>
  );
};
export default React.memo(MediaAssetPreviewPlayer);
