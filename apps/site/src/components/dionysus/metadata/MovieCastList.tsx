import {
  FilterFilled,
  ProfileOutlined,
  TableOutlined,
} from "@ant-design/icons";
import type { MovieCastMember } from "@ncfritz/olympus-sdk/dionysus";
import { Input, List, Radio, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import PersonCard from "./PersonCard";

export interface MovieCastListProps {
  cast: MovieCastMember[];
  filterable?: boolean;
  defaultLayout?: "grid" | "list";
}

const MovieCastList: React.FunctionComponent<MovieCastListProps> = ({
  cast,
  filterable = true,
  defaultLayout = "grid",
}: MovieCastListProps) => {
  const [filter, setFilter] = useState<string>("");
  const [filteredCast, setFilteredCast] = useState(cast);
  const [layout, setLayout] = useState<"list" | "grid">(defaultLayout);

  const [debouncedFilter] = useDebounce<string>(filter, 300);

  useEffect(() => {
    if (debouncedFilter && debouncedFilter.length >= 3) {
      const newFilteredCast = cast.filter((item) => {
        return item.person.name
          .toLowerCase()
          .includes(debouncedFilter.toLowerCase());
      });

      setFilteredCast(newFilteredCast);
    } else if (debouncedFilter.length <= 0) {
      setFilteredCast(cast);
    }
  }, [debouncedFilter]);

  const columns = layout === "grid" ? 12 : 1;

  return (
    <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
      {filterable && (
        <Space
          direction={"horizontal"}
          style={{
            padding: 8,
            background: "#fafafa",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Input
            size={"small"}
            prefix={
              <FilterFilled
                style={{
                  color: debouncedFilter?.length >= 3 ? "#1677ff" : "#afafaf",
                }}
              />
            }
            placeholder={"Search by name"}
            allowClear={true}
            style={{
              width: 500,
              background: "#ffffff",
              borderColor: "#efefef",
            }}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value.trim());
            }}
          />
          <Radio.Group
            size={"small"}
            optionType={"button"}
            defaultValue={layout}
            className={"dionysus-filter-header"}
            onChange={(e) => {
              setLayout(e.target.value);
            }}
            options={[
              {
                value: "list",
                label: <ProfileOutlined />,
              },
              {
                value: "grid",
                label: <TableOutlined />,
              },
            ]}
          />
        </Space>
      )}
      <List
        style={{ padding: 16, paddingTop: 8 }}
        grid={{ column: columns, gutter: 16 }}
        dataSource={filteredCast}
        renderItem={(item) => {
          const characterInfo = (
            <Typography.Text
              style={{
                fontSize: "9px",
                color: "#666666",
                lineHeight: 1,
              }}
            >
              {item.character}
            </Typography.Text>
          );

          return (
            <List.Item>
              {layout === "grid" ? (
                <PersonCard direction={"vertical"} person={item.person}>
                  {characterInfo}
                </PersonCard>
              ) : (
                <PersonCard direction={"horizontal"} person={item.person}>
                  {characterInfo}
                </PersonCard>
              )}
            </List.Item>
          );
        }}
      />
    </Space>
  );
};
export default MovieCastList;
