import { CloseCircleFilled } from "@ant-design/icons";
import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Space, Typography } from "antd";
import type {
  TagRenderedOptionsWithState,
  TagRenderer,
} from "./ContentAssetTagSelector";
import { getTagColor } from "./util";

export interface SelectableTagProps {
  tag: ContentAssetTag;
  color: string;
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
  onRemoveTag?: (tag: ContentAssetTag) => Promise<void>;
  checked?: boolean;
  allowClear?: boolean;
}

export interface SelectableTagRenderOptions extends TagRenderedOptionsWithState {
  allowClear?: boolean;
}

export const SelectableTagRenderer: TagRenderer<SelectableTagRenderOptions> = (
  tag,
  options,
) => {
  return (
    <SelectableTag
      key={tag.id}
      tag={tag}
      color={getTagColor(tag)}
      onSelectTag={options?.onSelectTag}
      onRemoveTag={options?.onRemoveTag}
      checked={options?.checked}
      allowClear={options?.allowClear}
    />
  );
};

const SelectableTag: React.FunctionComponent<SelectableTagProps> = ({
  tag,
  color,
  onSelectTag,
  onRemoveTag,
  checked = false,
  allowClear = false,
}: SelectableTagProps) => {
  const onChange = async () => {
    if (onSelectTag && !checked) {
      await onSelectTag(tag);
    } else if (onRemoveTag) {
      await onRemoveTag(tag);
    }
  };

  return (
    <Space
      size={8}
      direction="horizontal"
      align="center"
      style={{
        width: "100%",
        padding: onRemoveTag && allowClear ? 1 : 3,
        paddingLeft: 10,
        borderRadius: 4,
        borderLeft: `8px solid ${checked ? color : `${color}44`}`,
        background: checked ? "#e0e0e0" : "#f8f8f8",
        cursor: "pointer",
      }}
      styles={{ item: { width: "100%" } }}
    >
      <Space
        direction={"horizontal"}
        style={{ width: "100%", justifyContent: "space-between" }}
        size={8}
        onClick={async () => {
          await onChange();
        }}
      >
        <Typography.Text
          style={{
            fontSize: "11px",
            fontWeight: checked ? 700 : "inherit",
          }}
        >
          {tag.name}
        </Typography.Text>
        {allowClear && onRemoveTag && (
          <Button
            type={"text"}
            size={"small"}
            style={{ fontSize: "11px", color: "#cccccc" }}
            icon={<CloseCircleFilled />}
            onClick={async () => {
              await onRemoveTag(tag);
            }}
          />
        )}
      </Space>
    </Space>
  );
};
export default SelectableTag;
