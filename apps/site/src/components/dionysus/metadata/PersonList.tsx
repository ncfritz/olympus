import { FilterFilled } from "@ant-design/icons";
import type { BasePerson } from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Flex,
  Input,
  List,
  Slider,
  Space,
  Typography,
} from "antd";
import type { FilterValue } from "antd/es/table/interface";
import Link from "next/link";
import React, { useState } from "react";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import { useFetch } from "../../../hooks/useFetch";
import LoadingWrapper from "../../common/LoadingWrapper";
import PersonCard from "./PersonCard";

export interface PersonListProps {
  title?: string;
  initialFilters?: Record<string, FilterValue>;
  initialSort?: SortOptions;
  listType: string;
  columns?: number;
  rows?: number;
}

const PersonList: React.FunctionComponent<PersonListProps> = ({
  title,
  initialFilters,
  initialSort = {
    field: "popularity",
    order: "desc",
  },
  listType,
  rows = 1,
  columns = 12,
}: PersonListProps) => {
  const [sort, setSort] = useState(initialSort);
  const [filters, setFilters] = useState(initialFilters);
  const [nameFilter, setNameFilter] = useState("");

  const [people, peopleLoading, peopleError] = useFetch<
    undefined,
    BasePerson[]
  >({
    dataType: listType,
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.listPeople(0, columns * rows, sort, filters)).data
        .people,
  });

  return (
    <LoadingWrapper loading={peopleLoading} error={peopleError}>
      {title && (
        <Typography.Title level={4} style={{ marginBottom: 0, marginLeft: 16 }}>
          {title}
        </Typography.Title>
      )}
      <Space
        direction={"horizontal"}
        size={8}
        style={{ backgroundColor: "#efefef", width: "100%", padding: 8 }}
      >
        <Input
          size={"small"}
          prefix={<FilterFilled style={{ color: "#cccccc" }} />}
          placeholder={"Search by name"}
          allowClear={true}
          style={{
            width: 500,
            background: "#ffffff",
            borderColor: "#efefef",
          }}
          value={nameFilter}
          onChange={(e) => {
            setNameFilter(e.target.value.trim());
          }}
        />
        <Dropdown
          trigger={["click"]}
          popupRender={(menus) => {
            return (
              <Space
                direction={"vertical"}
                size={0}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 6,
                }}
              >
                {React.cloneElement(
                  menus as React.ReactElement<{
                    style: React.CSSProperties;
                  }>,
                  { style: { boxShadow: "none" } },
                )}
                <Divider style={{ margin: 0 }} />
                <Flex justify={"space-between"} style={{ margin: 4 }}>
                  <Button type={"link"} size={"small"}>
                    Reset
                  </Button>
                  <Button type={"primary"} size={"small"}>
                    Ok
                  </Button>
                </Flex>
              </Space>
            );
          }}
          menu={{
            onClick: ({ item, key, keyPath, domEvent }) => {
              domEvent.stopPropagation();
            },
            onSelect: ({ item, key, keyPath, domEvent }) => {
              domEvent.stopPropagation();
            },
            items: [
              {
                type: "item",
                key: "filter-gender-unknown",
                onClick: ({ item, key, keyPath, domEvent }) =>
                  domEvent.stopPropagation(),
                label: (
                  <Checkbox onClick={(e) => e.stopPropagation()}>
                    Unknown
                  </Checkbox>
                ),
              },
              {
                type: "item",
                key: "filter-gender-male",
                onClick: ({ item, key, keyPath, domEvent }) =>
                  domEvent.stopPropagation(),
                label: (
                  <Checkbox onClick={(e) => e.stopPropagation()}>Male</Checkbox>
                ),
              },
              {
                type: "item",
                key: "filter-gender-female",
                onClick: ({ item, key, keyPath, domEvent }) =>
                  domEvent.stopPropagation(),
                label: (
                  <Checkbox onClick={(e) => e.stopPropagation()}>
                    Female
                  </Checkbox>
                ),
              },
              {
                type: "item",
                key: "filter-gender-non",
                onClick: ({ item, key, keyPath, domEvent }) =>
                  domEvent.stopPropagation(),
                label: (
                  <Checkbox onClick={(e) => e.stopPropagation()}>
                    Non-Binary
                  </Checkbox>
                ),
              },
            ],
          }}
        >
          <Space
            size={0}
            style={{
              marginLeft: 8,
              color: "#000000",
              alignItems: "center",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Gender
            <Button
              size={"small"}
              type={"text"}
              icon={
                <FilterFilled style={{ fontSize: "12px", color: "#b0b0b0" }} />
              }
            />
          </Space>
        </Dropdown>
        <Dropdown
          trigger={["click"]}
          popupRender={(menus) => {
            return (
              <Space
                direction={"vertical"}
                size={0}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 6,
                }}
              >
                {React.cloneElement(
                  menus as React.ReactElement<{
                    style: React.CSSProperties;
                  }>,
                  { style: { boxShadow: "none" } },
                )}
                <Divider style={{ margin: 0 }} />
                <Flex justify={"space-between"} style={{ margin: 4 }}>
                  <Button type={"link"} size={"small"}>
                    Reset
                  </Button>
                  <Button type={"primary"} size={"small"}>
                    Ok
                  </Button>
                </Flex>
              </Space>
            );
          }}
          menu={{
            onClick: ({ item, key, keyPath, domEvent }) => {
              domEvent.stopPropagation();
            },
            onSelect: ({ item, key, keyPath, domEvent }) => {
              domEvent.stopPropagation();
            },
            items: [
              {
                type: "item",
                key: "filter-gender-unknown",
                onClick: ({ item, key, keyPath, domEvent }) =>
                  domEvent.stopPropagation(),
                label: (
                  <Slider
                    min={0}
                    max={120}
                    step={1}
                    range={true}
                    defaultValue={[0, 120]}
                    style={{ width: 350, paddingBottom: 48 }}
                    tooltip={{
                      open: true,
                      placement: "bottom",
                      color: "#b0b0b0",
                    }}
                  />
                ),
              },
            ],
          }}
        >
          <Space
            size={0}
            style={{
              marginLeft: 8,
              color: "#000000",
              alignItems: "center",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Age
            <Button
              size={"small"}
              type={"text"}
              icon={
                <FilterFilled style={{ fontSize: "12px", color: "#b0b0b0" }} />
              }
            />
          </Space>
        </Dropdown>
      </Space>
      <List
        grid={{ gutter: 16, column: columns }}
        style={{ margin: 16, marginTop: 8, marginBottom: 0 }}
        dataSource={people}
        renderItem={(item) => {
          return (
            <List.Item>
              <Link href={`/dionysus/person/${item.id}`}>
                <PersonCard person={item} direction={"vertical"}>
                  <Space direction={"horizontal"} size={8}>
                    <Typography.Text strong={true} style={{ fontSize: "10px" }}>
                      Score:
                    </Typography.Text>
                    <Typography.Text style={{ fontSize: "10px" }}>
                      {item.popularity}
                    </Typography.Text>
                  </Space>
                </PersonCard>
              </Link>
            </List.Item>
          );
        }}
      />
    </LoadingWrapper>
  );
};
export default PersonList;
