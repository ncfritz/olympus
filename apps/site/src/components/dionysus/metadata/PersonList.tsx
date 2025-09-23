import type { BasePerson } from "@ncfritz/olympus-sdk/dionysus";
import { List, Space, Typography } from "antd";
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

  const [people, peopleLoading, peopleError] = useFetch<
    undefined,
    BasePerson[]
  >({
    dataType: listType,
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.listPeople(0, columns * rows, sort, filters)).data.people,
  });

  return (
    <LoadingWrapper loading={peopleLoading} error={peopleError}>
      {title && <Typography.Title level={4}>{title}</Typography.Title>}
      <List
        grid={{ gutter: 16, column: columns }}
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
