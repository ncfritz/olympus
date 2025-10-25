import { Checkbox, Menu, Space } from "antd";
import type { MenuItemType } from "antd/es/menu/interface";
import { useEffect, useState } from "react";
import FilterWrapper from "./FilterWrapper";

export interface CheckboxFilterProps {
  label: string;
  items: MenuItemType[];
  onFiltersSet: (values: React.Key[]) => void;
  filterValues?: (values: string[]) => string[];
}

const CheckboxFilter: React.FunctionComponent<CheckboxFilterProps> = ({
  label,
  items,
  onFiltersSet,
  filterValues,
}: CheckboxFilterProps) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [values, setValues] = useState<React.Key[]>([]);

  useEffect(() => {
    onFiltersSet(selectedKeys);
  }, [selectedKeys]);

  const menuItems = items.map((item) => {
    return {
      ...item,
      label: (
        <Space direction={"horizontal"}>
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
        const newKeys = [...selectedKeys];
        const newValues = [...values];

        if (newKeys.includes(key.toString())) {
          const index = newKeys.indexOf(key.toString());

          newKeys.splice(index);
          newValues.splice(index);
        } else {
          newKeys.push(key.toString());
          newValues.push(key);
        }

        setSelectedKeys(filterValues ? filterValues(newKeys) : newKeys);
      }}
    />
  );

  return (
    <FilterWrapper
      label={label}
      filters={menu}
      onReset={() => {
        setSelectedKeys([]);
        setValues([]);
      }}
      onClose={() => {
        return selectedKeys.length;
      }}
    />
  );
};
export default CheckboxFilter;
