import { Image, Space } from "antd";
import type { CSSProperties } from "react";
import { CONTENT_CDN_HOST } from "../../utils/constants";

export interface ContentAssetFixedRatioImageProps {
  assetId: string;
  previewIndex: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  forceMax?: boolean;
  allowPreview?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

const ContentAssetFixedRatioImage: React.FunctionComponent<
  ContentAssetFixedRatioImageProps
> = ({
  assetId,
  previewIndex,
  width,
  height,
  maxWidth,
  maxHeight,
  style,
  allowPreview = true,
  forceMax = false,
  onClick,
}: ContentAssetFixedRatioImageProps) => {
  const ratio = width / height;

  let imgHeight = height > maxHeight ? maxHeight : height;
  let imgWidth = imgHeight * ratio;
  let fullWidth = false;

  if (imgWidth > maxWidth) {
    imgWidth = maxWidth;
    imgHeight = imgWidth / ratio;
    fullWidth = true;
  }

  let borderRadius = 0;

  if (imgHeight >= maxHeight - 16 && imgWidth >= maxWidth - 16) {
    borderRadius = (imgHeight - maxHeight - 16) / 2;
  }

  return (
    <Space
      direction={"horizontal"}
      style={{
        width: forceMax ? maxWidth : "100%",
        background: "#000000",
        alignContent: "center",
        justifyContent: "center",
        height: maxHeight,
        ...style,
      }}
      styles={{ item: { textAlign: "center" } }}
    >
      <Image
        src={`${CONTENT_CDN_HOST}/assets/${assetId}/thumbnails/${previewIndex}.png`}
        preview={allowPreview && !onClick}
        width={fullWidth ? "100%" : imgWidth}
        height={imgHeight}
        style={{
          maxHeight: maxHeight,
          aspectRatio: ratio,
          borderTopRightRadius: borderRadius,
          borderTopLeftRadius: borderRadius,
          ...style,
        }}
        onClick={onClick}
      />
    </Space>
  );
};
export default ContentAssetFixedRatioImage;
