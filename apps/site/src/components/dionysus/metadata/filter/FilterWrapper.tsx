import { FilterFilled } from "@ant-design/icons";
import { Button, Divider, Dropdown, Flex, Space } from "antd";
import React, { type ReactNode, useState } from "react";

export interface FilterWrapperProps {
  label: ReactNode;
  filters: ReactNode | ReactNode[];
  onReset: () => void;
  onClose: () => number;
  initialFiltersPresent?: boolean;
}

const FilterWrapper: React.FunctionComponent<FilterWrapperProps> = ({
  label,
  filters,
  onReset,
  onClose,
  initialFiltersPresent = false,
}: FilterWrapperProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filtersPresent, setFiltersPresent] = useState(initialFiltersPresent);

  const handleClose = () => {
    const filterCount = onClose();
    setFiltersPresent(filterCount > 0);
  };

  return (
    <Dropdown
      trigger={["click"]}
      onOpenChange={(open, info) => {
        if (!open && info.source === "menu") {
          return;
        }

        handleClose();
        setDropdownOpen(open);
      }}
      open={dropdownOpen}
      popupRender={() => {
        return (
          <Space
            direction={"vertical"}
            size={0}
            style={{
              minWidth: 150,
              backgroundColor: "#ffffff",
              borderRadius: 6,
            }}
          >
            {filters}
            <Divider style={{ margin: 0 }} />
            <Flex justify={"space-between"} style={{ margin: 4 }}>
              <Button type={"link"} size={"small"} onClick={onReset}>
                Reset
              </Button>
              <Button
                type={"primary"}
                size={"small"}
                onClick={() => {
                  handleClose();
                  setDropdownOpen(false);
                }}
              >
                Ok
              </Button>
            </Flex>
          </Space>
        );
      }}
    >
      <Space
        size={0}
        style={{
          marginLeft: 8,
          color: "#000000",
          alignItems: "center",
          fontSize: "12px",
          fontWeight: 400,
          cursor: "pointer",
        }}
      >
        {label}
        <Button
          size={"small"}
          type={"text"}
          icon={
            <FilterFilled
              style={{
                fontSize: "12px",
                color: filtersPresent ? "#1677ff" : "#afafaf",
              }}
            />
          }
        />
      </Space>
    </Dropdown>
  );
};
export default FilterWrapper;
