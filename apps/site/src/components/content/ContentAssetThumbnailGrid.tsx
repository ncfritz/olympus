import type { ContentAsset } from "@ncfritz/olympus-sdk/dionysus";
import { Image, Space, Spin } from "antd";
import { v4 as uuidv4 } from "uuid";
import ContentAssetFixedRatioImage from "./ContentAssetFixedRatioImage";

interface ContentAssetThumbnailGridProps {
  asset: ContentAsset;
  height?: number;
  onSelect?: (index: number) => void;
  rows?: 2 | 4;
  ratio?: number;
  forceMax?: boolean;
  disablePreview?: boolean;
  imageCount?: 4 | 8 | 16;
}

const ContentAssetThumbnailGrid: React.FunctionComponent<
  ContentAssetThumbnailGridProps
> = ({
  asset,
  height = 125,
  onSelect,
  rows,
  ratio = 1,
  imageCount = 16,
  disablePreview = false,
  forceMax = false,
}: ContentAssetThumbnailGridProps) => {
  const aspectRatio = asset.width / asset.height;
  let finalImageCount = aspectRatio > 1 ? 4 : 8;

  if (rows) {
    finalImageCount = imageCount / rows;
  }

  const generateImageRow = (
    row: number,
    count: number,
    increment: number = 1,
  ) => {
    const images = [];

    for (let i = row * count + 1; i <= (row + 1) * count; i++) {
      const width = ratio * height;

      images.push(
        <div
          key={`catg-img-${i}`}
          onClick={() => {
            if (onSelect) {
              onSelect(i);
            }
          }}
          style={{ cursor: onSelect ? "pointer" : "inherit" }}
        >
          <ContentAssetFixedRatioImage
            assetId={asset.id}
            previewIndex={i * increment}
            width={asset.width}
            height={asset.height}
            maxWidth={width}
            maxHeight={height}
            allowPreview={!(disablePreview || onSelect)}
            forceMax={forceMax}
            style={{ borderRadius: 4 }}
          />
        </div>,
      );
    }

    return (
      <Space size={8} direction={"horizontal"} key={uuidv4()}>
        {images}
      </Space>
    );
  };

  const content = [];
  const increment = 16 / imageCount;

  for (
    let i = 0, total = 0;
    total < imageCount;
    i++, total += finalImageCount
  ) {
    content.push(generateImageRow(i, finalImageCount, increment));
  }

  return (
    <Space size={8} direction={"vertical"}>
      {content}
    </Space>
  );
};
export default ContentAssetThumbnailGrid;
