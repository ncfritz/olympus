import {
  FilterFilled,
  InfoCircleOutlined,
  ProfileOutlined,
  TableOutlined,
} from "@ant-design/icons";
import type { TvSeriesCastMember } from "@ncfritz/olympus-sdk/dionysus";
import { Input, List, Popover, Radio, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import PersonCard from "./PersonCard";

export interface TvSeriesCastList {
  cast: TvSeriesCastMember[];
}

const TvSeriesCastList: React.FunctionComponent<TvSeriesCastList> = ({
  cast,
}: TvSeriesCastList) => {
  const [filter, setFilter] = useState<string>("");
  const [filteredCast, setFilteredCast] = useState(cast);
  const [layout, setLayout] = useState<"list" | "grid">("list");

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
          style={{ width: 500, background: "#ffffff", borderColor: "#efefef" }}
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
      <List
        style={{ padding: 16 }}
        grid={{ column: columns, gutter: 16 }}
        dataSource={filteredCast}
        renderItem={(item) => {
          const rolesContent = item.roles.map((role) => {
            return (
              <Space orientation={"horizontal"}>
                <Typography.Text style={{ fontSize: "11px" }}>
                  {role.character}
                </Typography.Text>
                <Typography.Text style={{ fontSize: "10px", color: "#666666" }}>
                  ({role.episodeCount}{" "}
                  {role.episodeCount > 1 ? "episodes" : "episode"})
                </Typography.Text>
              </Space>
            );
          });

          return (
            <List.Item>
              {layout === "grid" ? (
                <PersonCard direction={"vertical"} person={item.person}>
                  <Typography.Text
                    style={{
                      fontSize: "10px",
                      lineHeight: 1,
                    }}
                  >
                    <Popover
                      content={
                        <Space size={0} direction={"vertical"}>
                          {rolesContent}
                        </Space>
                      }
                    >
                      <Space
                        direction={"horizontal"}
                        size={4}
                        style={{ alignItems: "start" }}
                      >
                        <InfoCircleOutlined />
                        <Space orientation={"vertical"} size={2}>
                          {`${item.totalEpisodeCount} episode${item.totalEpisodeCount > 1 ? "s" : ""}`}
                          {`${item.roles.length} role${item.roles.length > 1 ? "s" : ""}`}
                        </Space>
                      </Space>
                    </Popover>
                  </Typography.Text>
                </PersonCard>
              ) : (
                <PersonCard
                  direction={"horizontal"}
                  person={item.person}
                  titleExtra={
                    <Typography.Text
                      style={{
                        fontSize: "9px",
                        color: "#666666",
                        lineHeight: 1,
                      }}
                    >
                      ({item.totalEpisodeCount}{" "}
                      {item.totalEpisodeCount > 1 ? "episodes" : "episode"})
                    </Typography.Text>
                  }
                >
                  <Space
                    direction={"vertical"}
                    size={2}
                    style={{ width: "100%" }}
                  >
                    {rolesContent}
                  </Space>
                </PersonCard>
              )}
            </List.Item>
          );
        }}
      />
    </Space>
  );
};
export default TvSeriesCastList;
