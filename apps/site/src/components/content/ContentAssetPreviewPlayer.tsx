import dynamic from "next/dynamic";
const Plyr = dynamic(() => import("plyr-react"), { ssr: false });
import React from "react";

export interface ContentAssetPreviewPlayerProps {
  assetId: string;
  type: "timelapse" | "sample";
  width?: number;
  height?: number;
}

const ContentAssetPreviewPlayer: React.FunctionComponent<
  ContentAssetPreviewPlayerProps
> = ({ assetId, type, width, height }: ContentAssetPreviewPlayerProps) => {
  return (
    <div
      style={{
        width: width,
        height: height,
      }}
    >
      <Plyr
        source={{
          type: "video",
          sources: [
            {
              src: `https://content-cdn.sea.ncfritz.net:9443/assets/${assetId}/${type}.mp4`,
              type: "video/mp4",
            },
          ],
        }}
        options={{
          controls: ["play", "progress", "current-time"],
          muted: true,
          clickToPlay: true,
        }}
      />
    </div>
  );
};
export default React.memo(ContentAssetPreviewPlayer);
