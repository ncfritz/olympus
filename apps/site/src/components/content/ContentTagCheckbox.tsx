import { Checkbox, Space } from "antd";
import { useState } from "react";
import type { ContentAssetTag as ContentAssetTagType } from "../../pages/dionysus/content/assets";

export interface ContentTagCheckboxProps {
  tag: any;
  onSelectTag: (tag: ContentAssetTagType) => Promise<void>;
  onRemoveTag: (tag: ContentAssetTagType) => Promise<void>;
}

const ContentTagCheckbox: React.FunctionComponent<ContentTagCheckboxProps> = ({
  tag,
  onSelectTag,
  onRemoveTag,
}: ContentTagCheckboxProps) => {
  const [checked, setChecked] = useState(false);

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
        borderRight: "8px solid #FFCC33",
        background: checked ? "#e0e0e0" : "#f8f8f8",
        cursor: "pointer",
      }}
      onClick={onChange}
    >
      <Checkbox onClick={onChange} checked={checked} />
      {tag.name}
    </Space>
  );
};
export default ContentTagCheckbox;
