import { CheckCircleFilled } from "@ant-design/icons";
import { Menu, Space } from "antd";
import type { MenuItemType } from "antd/es/menu/interface";
import { useEffect, useState } from "react";
import FilterWrapper from "./FilterWrapper";

export interface CheckboxFilterProps {
  label: string;
  items: MenuItemType[];
  onFiltersSet: (value?: React.Key) => void;
}

const SingleSelectionFilter: React.FunctionComponent<CheckboxFilterProps> = ({
  label,
  items,
  onFiltersSet,
}: CheckboxFilterProps) => {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    onFiltersSet(selectedKey);
  }, [selectedKey]);

  const menuItems = items.map((item) => {
    return {
      ...item,
      label: (
        <Space
          direction={"horizontal"}
          style={{
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {item.label}
          {item.key === selectedKey ? <CheckCircleFilled /> : undefined}
        </Space>
      ),
    };
  });

  const menu = (
    <Menu
      style={{ boxShadow: "none" }}
      items={menuItems}
      onClick={({ key }) => {
        if (key !== selectedKey) {
          setSelectedKey(key);
          close();
        }
      }}
    />
  );

  return (
    <FilterWrapper
      label={label}
      filters={menu}
      onReset={() => {
        setSelectedKey(undefined);
      }}
      onClose={() => {
        return selectedKey ? 1 : 0;
      }}
    />
  );
};
export default SingleSelectionFilter;
