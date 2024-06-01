import { StarFilled } from "@ant-design/icons";
import { Rate } from "antd";
import axios from "axios";
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
        await axios.put(
          `http://localhost:3001/v1/content/asset/${asset.id}/rating`,
          {
            rating: value,
          },
        );

        if (onRatingSet) {
          await onRatingSet(value);
        }
      }}
    />
  );
};
export default ContentAssetRating;
