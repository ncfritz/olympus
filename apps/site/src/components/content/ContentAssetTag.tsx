import { CloseOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import type { ContentAssetTag } from "../../pages/dionysus/content/assets";

export interface ContentAssetTagElementProps {
  assetId: string;
  tag: ContentAssetTag;
  onRemove?: (tag: ContentAssetTag) => Promise<void>;
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
}

const TYPE_COLORS = {
  type: "#aa0000",
  source: "#6b32a8",
  system: "#bf6c00",
  user: "#0026bf",
  model: "#33493f",
};

const ContentAssetTagElement: React.FunctionComponent<
  ContentAssetTagElementProps
> = ({ assetId, tag, onRemove, onSelectTag }: ContentAssetTagElementProps) => {
  return (
    <Tag
      closable={onRemove !== undefined}
      closeIcon={<CloseOutlined style={{ color: TYPE_COLORS[tag.type] }} />}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        color: TYPE_COLORS[tag.type],
        cursor: onSelectTag !== undefined ? "pointer" : "inherit",
      }}
      color={`${TYPE_COLORS[tag.type]}44`}
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
