import { StarFilled } from "@ant-design/icons";
import type { ContentAsset } from "@ncfritz/olympus-sdk/dionysus";
import { Rate } from "antd";
import contentApi from "../../api/contentApi";

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
