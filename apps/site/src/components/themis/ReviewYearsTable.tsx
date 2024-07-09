import {Avatar, Progress, Space, Table, type TableProps, Typography} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import React, { useState } from "react";
import type { SortOptions } from "../../api/contentApi";
import type { Certification } from "../../pages/dionysus/metadata/certifications";
import type { BasicUserInfo, ReviewYear } from "../../types/themis";

export interface UsersTableProps {
  reviews: ReviewYear[];
  loading: boolean;
}

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const UsersTable: React.FunctionComponent<UsersTableProps> = ({
  reviews,
  loading,
}) => {
  const [sort, setSort] = useState<SortOptions>({
    field: "year",
    order: "asc",
  });

  const columns: ColumnsType<ReviewYear> = [
    {
      key: "year",
      title: "Year",
      dataIndex: "year",
      render: (value, record) => {
        return <Typography.Text>{record.year}</Typography.Text>;
      },
      sorter: true,
      width: 100,
    },
    {
      key: "users",
      title: "Users In Review",
      dataIndex: "users",
      render: (value, record) => {
        return (
          <Avatar.Group shape={"circle"} size={"small"}>
            {record.users.map((user) => {
              return (
                <Avatar
                  src={`https://cdn.ncfritz.net/amzn/avatar/${user.username}.jpg`}
                />
              );
            })}
          </Avatar.Group>
        );
      },
      sorter: false,
      width: 250,
    },
    {
      key: "ratings",
      title: "Ratings Complete",
      dataIndex: "users",
      render: (value, record) => {
        const percentComplete = record.ratingsComplete / record.users.length;

        return <Progress size={"small"} percent={percentComplete} />;
      },
      sorter: false,
    },
  ];

  return (
    <Table
      style={{ width: "100%" }}
      rowKey={"id"}
      columns={columns}
      dataSource={reviews}
      size={"middle"}
      loading={loading}
      onChange={(pagination, filters, sorter, extra) => {
        const s = sorter as Sorts;

        switch (extra.action) {
          case "sort":
            setSort({
              field: s.columnKey?.toString() || "",
              order: s.order === "ascend" ? "asc" : "desc",
            });
            break;
          case "filter":
            break;
        }
      }}
    />
  );
};
export default UsersTable;
