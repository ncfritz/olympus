import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import { Checkbox, Space, Typography } from "antd";
import { useState } from "react";
import type {
  TagRenderedOptionsWithState,
  TagRenderer,
} from "./ContentAssetTagSelector";
import { getTagColor } from "./util";

export interface ContentTagCheckboxProps {
  tag: ContentAssetTag;
  color: string;
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
  onRemoveTag?: (tag: ContentAssetTag) => Promise<void>;
  initialState?: boolean;
  renderCheckbox?: boolean;
}

export interface CheckboxTagRendererOptions extends TagRenderedOptionsWithState {
  renderCheckbox?: boolean;
  initialState?: boolean;
}

export const CheckboxTagRenderer: TagRenderer<CheckboxTagRendererOptions> = (
  tag,
  options,
) => {
  return (
    <ContentTagCheckbox
      key={tag.id}
      tag={tag}
      color={getTagColor(tag)}
      onSelectTag={options?.onSelectTag}
      onRemoveTag={options?.onRemoveTag}
      initialState={options?.initialState}
      renderCheckbox={true}
    />
  );
};

const ContentTagCheckbox: React.FunctionComponent<ContentTagCheckboxProps> = ({
  tag,
  color,
  onSelectTag,
  onRemoveTag,
  renderCheckbox = true,
  initialState = false,
}: ContentTagCheckboxProps) => {
  const [checked, setChecked] = useState(initialState);

  const onChange = async () => {
    if (onSelectTag && !checked) {
      await onSelectTag(tag);
    } else if (onRemoveTag) {
      await onRemoveTag(tag);
    }

    setChecked(!checked);
  };

  return (
    <Space
      size={8}
      direction="horizontal"
      align="center"
      style={{
        width: "100%",
        padding: 3,
        paddingLeft: 8,
        borderRadius: 4,
        borderRight: `8px solid ${checked ? color : `${color}44`}`,
        background: checked ? "#e0e0e0" : "#f8f8f8",
        cursor: "pointer",
      }}
      onClick={onChange}
    >
      {renderCheckbox && <Checkbox onClick={onChange} checked={checked} />}
      <Typography.Text
        style={{ fontSize: "11px", fontWeight: checked ? 700 : "inherit" }}
      >
        {tag.name}
      </Typography.Text>
    </Space>
  );
};
export default ContentTagCheckbox;
