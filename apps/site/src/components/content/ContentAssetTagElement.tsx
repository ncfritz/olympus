import { CloseOutlined } from "@ant-design/icons";
import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import { Tag } from "antd";
import { getTagColor } from "./util";

export interface ContentAssetTagElementProps {
  tag: ContentAssetTag;
  onRemove?: (tag: ContentAssetTag) => Promise<void>;
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
}

const ContentAssetTagElement: React.FunctionComponent<
  ContentAssetTagElementProps
> = ({ tag, onRemove, onSelectTag }: ContentAssetTagElementProps) => {
  const tagColor = getTagColor(tag);

  return (
    <Tag
      closable={onRemove !== undefined}
      closeIcon={<CloseOutlined style={{ color: tagColor }} />}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        color: tagColor,
        cursor: onSelectTag !== undefined ? "pointer" : "inherit",
      }}
      color={`${tagColor}44`}
      onClose={async () => {
        if (onRemove) {
          await onRemove(tag);
        }
      }}
      onClick={async () => {
        if (onSelectTag) {
          await onSelectTag(tag);
        }
      }}
    >
      {tag.name}
    </Tag>
  );
};
export default ContentAssetTagElement;
