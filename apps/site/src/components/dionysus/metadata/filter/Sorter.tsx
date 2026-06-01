import { CaretDownOutlined, CaretUpOutlined } from "@ant-design/icons";
import type { SortDirection } from "@ncfritz/olympus-sdk/olympus";
import { Dropdown, type MenuProps, Space, Typography } from "antd";
import { useEffect, useState } from "react";

export interface SorterProps {
  initialSort: string;
  initialDirection?: SortDirection;
  sortOptions: Record<string, string>;
  onSortChange: (sort: string, direction: SortDirection) => void;
}

const Sorter: React.FunctionComponent<SorterProps> = ({
  initialSort,
  initialDirection = "desc",
  sortOptions,
  onSortChange,
}: SorterProps) => {
  const [direction, setDirection] = useState(initialDirection);
  const [field, setField] = useState(initialSort);

  useEffect(() => {
    onSortChange(field, direction);
  }, [direction, field]);

  const toggleDirection = () => {
    setDirection(direction === "asc" ? "desc" : "asc");
  };

  const items: MenuProps["items"] = Object.entries(sortOptions).map((item) => {
    return {
      key: item[0],
      label: item[1],
      onClick: () => setField(item[0]),
    };
  });

  return (
    <Space direction={"horizontal"}>
      <Dropdown trigger={["click"]} menu={{ items: items }}>
        <Typography.Text
          style={{
            marginLeft: 8,
            color: "#000000",
            alignItems: "center",
            fontSize: "12px",
            fontWeight: 400,
            cursor: "pointer",
          }}
        >
          {sortOptions[field] ? sortOptions[field] : "Unknown"}
        </Typography.Text>
      </Dropdown>
      <Space direction={"vertical"} size={0} style={{ lineHeight: 0 }}>
        <CaretUpOutlined
          style={{
            height: 12,
            width: 12,
            color: direction === "asc" ? "#1677ff" : "#afafaf",
          }}
          onClick={() => {
            toggleDirection();
          }}
        />
        <CaretDownOutlined
          style={{
            height: 12,
            width: 12,
            color: direction === "desc" ? "#1677ff" : "#afafaf",
          }}
          onClick={() => {
            toggleDirection();
          }}
        />
      </Space>
    </Space>
  );
};
export default Sorter;
