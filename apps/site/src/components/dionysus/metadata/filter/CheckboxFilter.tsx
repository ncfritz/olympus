import { Checkbox, Menu, Space } from "antd";
import type { MenuItemType } from "antd/es/menu/interface";
import { type ReactNode, useState } from "react";
import { toggleKey } from "../../../../utils/filters";
import FilterWrapper from "./FilterWrapper";

export interface CheckboxFilterProps {
  label: string | ReactNode;
  items: MenuItemType[];
  onFiltersSet: (values: React.Key[]) => void;
  filterValues?: (values: string[]) => string[];
  initialValues?: string[];
}

const CheckboxFilter: React.FunctionComponent<CheckboxFilterProps> = ({
  label,
  items,
  onFiltersSet,
  filterValues,
  initialValues,
}: CheckboxFilterProps) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    initialValues || [],
  );

  const menuItems = items.map((item) => {
    return {
      ...item,
      label: (
        <Space orientation={"horizontal"}>
          <Checkbox checked={selectedKeys.includes(item.key.toString())} />
          {item.label}
        </Space>
      ),
    };
  });

  const menu = (
    <Menu
      style={{ boxShadow: "none" }}
      items={menuItems}
      onClick={({ key }) => {
        const newKeys = toggleKey(selectedKeys, key.toString());

        setSelectedKeys(filterValues ? filterValues(newKeys) : newKeys);
      }}
    />
  );

  return (
    <FilterWrapper
      label={label}
      filters={menu}
      initialFiltersPresent={(initialValues?.length ?? 0) > 0}
      onReset={() => {
        setSelectedKeys(initialValues || []);
      }}
      onClose={() => {
        onFiltersSet(selectedKeys);
        return selectedKeys.length;
      }}
    />
  );
};
export default CheckboxFilter;
