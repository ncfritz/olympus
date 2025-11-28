import { StarFilled } from "@ant-design/icons";
import { Rate } from "antd";
import axios from "axios";
import contentApi from "../../api/contentApi";
import type { ContentAsset } from "../../pages/dionysus/content/assets";

interface ContentAssetRatingProps {
  asset: ContentAsset;
  onRatingSet?: (value: number) => Promise<void>;
}

const ContentAssetRating: React.FunctionComponent<ContentAssetRatingProps> = ({
  asset,
  onRatingSet,
}: ContentAssetRatingProps) => {
  return (
    <Rate
      defaultValue={asset.rating || 0}
      count={5}
      allowHalf={true}
      allowClear={true}
      character={<StarFilled size={12} />}
      onChange={async (value) => {
        await contentApi.setContentAssetRating(asset.id, value);

        if (onRatingSet) {
          await onRatingSet(value);
        }
      }}
    />
  );
};
export default ContentAssetRating;
