import { Image, Space, Spin } from "antd";
import { v4 as uuidv4 } from "uuid";

interface ContentAssetThumbnailGridProps {
  asset: any;
  height?: number;
  seek?: (seconds: number) => void;
  onSelect?: (index: number) => void;
}

const ContentAssetThumbnailGrid: React.FunctionComponent<
  ContentAssetThumbnailGridProps
> = ({
  asset,
  height = 125,
  seek,
  onSelect,
}: ContentAssetThumbnailGridProps) => {
  const aspectRatio = asset.width / asset.height;
  const imageCount = aspectRatio > 1 ? 4 : 8;

  const generateImageRow = (row: number, count: number) => {
    const images = [];

    for (let i = row * count + 1; i <= (row + 1) * count; i++) {
      images.push(
        <Image
          key={`img-${asset.id}-${i}`}
          height={height}
          fallback={"/placeholder.png"}
          src={`https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/thumbnails/${i}.png`}
          placeholder={<Spin spinning={true} />}
          preview={
            seek || onSelect
              ? false
              : {
                  src: `https://content-cdn.sea.ncfritz.net:9443/assets/${asset.id}/screenshots/${i}.png`,
                }
          }
          onClick={() => {
            if (seek) {
              seek(Math.floor(((i / 16) * asset.durationMs) / 1000));
            }
            if (onSelect) {
              onSelect(i);
            }
          }}
        />,
      );
    }

    return (
      <Space size={8} direction={"horizontal"} key={uuidv4()}>
        {images}
      </Space>
    );
  };

  const content = [];

  for (let i = 0, total = 0; total < 16; i++, total += imageCount) {
    content.push(generateImageRow(i, imageCount));
  }

  return (
    <Space size={8} direction={"vertical"}>
      {content}
    </Space>
  );
};
export default ContentAssetThumbnailGrid;
