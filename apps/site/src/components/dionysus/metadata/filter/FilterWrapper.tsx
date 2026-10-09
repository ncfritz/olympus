import { CloseCircleFilled, FilterFilled } from "@ant-design/icons";
import { Button, Divider, Dropdown, Flex, Space } from "antd";
import React, { type ReactNode, useState } from "react";

export interface FilterWrapperProps {
  label: ReactNode;
  filters: ReactNode | ReactNode[];
  onReset: () => void;
  onClose: () => number;
  initialFiltersPresent?: boolean;
  onClear?: () => void;
}

const FilterWrapper: React.FunctionComponent<FilterWrapperProps> = ({
  label,
  filters,
  onReset,
  onClose,
  initialFiltersPresent = false,
  onClear,
}: FilterWrapperProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filtersPresent, setFiltersPresent] = useState(initialFiltersPresent);
  const [isFilterButtonHovered, setIsFilterButtonHovered] = useState(false);

  const handleClose = () => {
    console.log("FilterWrapper.handleClose()");

    const filterCount = onClose();
    setFiltersPresent(filterCount > 0);
  };

  const clearFilter = () => {
    console.log("FilterWrapper.clearFilter()");
    if (onClear) {
      onClear();
    }

    handleClose();
    setDropdownOpen(false);
  };

  return (
    <Dropdown
      trigger={["click"]}
      onOpenChange={(open, info) => {
        if (!open && info.source === "menu") {
          return;
        }

        if (!open) {
          handleClose();
        }

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
              <Space orientation={"horizontal"} size={8}>
                <Button type={"link"} size={"small"} onClick={onReset}>
                  Reset
                </Button>
                {onClear && filtersPresent && (
                  <Button
                    type={"link"}
                    size={"small"}
                    danger={true}
                    onClick={clearFilter}
                  >
                    Clear
                  </Button>
                )}
              </Space>
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
            isFilterButtonHovered && filtersPresent && onClear ? (
              <CloseCircleFilled
                style={{
                  fontSize: "12px",
                  color: "#afafaf",
                }}
              />
            ) : (
              <FilterFilled
                style={{
                  fontSize: "12px",
                  color: filtersPresent ? "#1677ff" : "#afafaf",
                }}
              />
            )
          }
          onMouseEnter={() => setIsFilterButtonHovered(true)}
          onMouseLeave={() => setIsFilterButtonHovered(false)}
          onClick={(e) => {
            if (filtersPresent && onClear) {
              console.log("FilterWrapper: Clear button click");
              e.preventDefault();
              e.stopPropagation();
              clearFilter();
            } else {
              setDropdownOpen(!dropdownOpen);
            }
          }}
        />
      </Space>
    </Dropdown>
  );
};
export default FilterWrapper;
