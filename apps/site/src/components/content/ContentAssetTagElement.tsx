import { CloseOutlined } from "@ant-design/icons";
import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import { Tag } from "antd";
import type {
  DefaultTagRendererOptions,
  TagRenderer,
} from "./ContentAssetTagSelector";
import { getTagColor } from "./util";

export interface ContentAssetTagElementProps {
  tag: ContentAssetTag;
  onRemoveTag?: (tag: ContentAssetTag) => Promise<void>;
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
}

export const ContentAssetTagElementRenderer: TagRenderer<
  DefaultTagRendererOptions
> = (tag, options) => {
  return (
    <ContentAssetTagElement
      key={tag.id}
      tag={tag}
      onSelectTag={options?.onSelectTag}
      onRemoveTag={options?.onRemoveTag}
    />
  );
};

const ContentAssetTagElement: React.FunctionComponent<
  ContentAssetTagElementProps
> = ({ tag, onRemoveTag, onSelectTag }: ContentAssetTagElementProps) => {
  const tagColor = getTagColor(tag);

  return (
    <Tag
      closable={onRemoveTag !== undefined}
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
        if (onRemoveTag) {
          await onRemoveTag(tag);
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
