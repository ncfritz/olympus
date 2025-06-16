import { Avatar, Space, Table, type TableProps, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import React, { useState } from "react";
import type { SortOptions } from "../../api/contentApi";
import type { Certification } from "../../pages/dionysus/metadata/certifications";
import type { BasicUserInfo } from "../../types/themis";

export interface UsersTableProps {
  users: BasicUserInfo[];
  loading: boolean;
}

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const UsersTable: React.FunctionComponent<UsersTableProps> = ({
  users,
  loading,
}) => {
  const [sort, setSort] = useState<SortOptions>({
    field: "username",
    order: "asc",
  });

  const columns: ColumnsType<BasicUserInfo> = [
    {
      key: "username",
      title: "Username",
      dataIndex: "username",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Avatar
              size={"small"}
              src={`https://cdn.internal.ncfritz.net/amzn/avatar/${record.username}.jpg`}
            />
            <Link href={`/themis/user/${record.username}`}>
              <Typography>{record.username}</Typography>
            </Link>
          </Space>
        );
      },
      sorter: true,
      width: 180,
    },
    {
      key: "givenName",
      title: "First Name",
      dataIndex: "givenName",
      render: (value, record) => {
        return <Typography.Text>{record.givenName}</Typography.Text>;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "surname",
      title: "Last Name",
      dataIndex: "surname",
      render: (value, record) => {
        return <Typography.Text>{record.surname}</Typography.Text>;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "lastHireDate",
      title: "Last Hire Date",
      dataIndex: "lastHireDate",
      render: (value, record) => {
        return <Typography.Text>{record.hireDate}</Typography.Text>;
      },
      sorter: true,
    },
  ];

  return (
    <Table
      style={{ width: "100%" }}
      rowKey={"id"}
      columns={columns}
      dataSource={users}
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
