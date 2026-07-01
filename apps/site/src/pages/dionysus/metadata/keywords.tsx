import { HomeOutlined } from "@ant-design/icons";
import type { Keyword } from "@ncfritz/olympus-sdk/dionysus";
import {
  ConfigProvider,
  Empty,
  Space,
  Table,
  type TableProps,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { useState } from "react";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import Timestamp from "../../../components/data/Timestamp";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";

type OnChange = NonNullable<TableProps<Keyword>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataKeywordsPage: React.FunctionComponent = () => {
  const [keywordsCount, setKeywordsCount] = useState(0);
  const [keywordsPage, setKeywordsPage] = useState(0);
  const [keywordsSort, setKeywordsSort] = useState<SortOptions>({
    field: "id",
    order: "asc",
  });

  const [keywords, keywordsLoading, keywordsError] = useFetch<
    undefined,
    Keyword[]
  >({
    dataType: "keywords",
    watch: [keywordsPage, keywordsSort],
    params: undefined,
    fetchFunction: async () => {
      const response = await metadataApi.listKeywords(
        keywordsPage,
        keywordsSort,
      );
      setKeywordsCount(response.data.count);
      return response.data.keywords;
    },
  });

  const columns: ColumnsType<Keyword> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
            <Typography>{record.id}</Typography>
          </Space>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "value",
      title: "Name",
      dataIndex: "value",
      render: (value, record) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
            <Typography>{record.value}</Typography>
          </Space>
        );
      },
      sorter: true,
    },
    {
      key: "createdTime",
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "last_updated_at",
      title: "Last Updated",
      dataIndex: "lastUpdatedTime",
      render: (value) => {
        return <Timestamp value={value} />;
      },
      sorter: true,
      width: 200,
    },
  ];

  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <MetadataOutlinedIcon />
                <span>Metadata</span>
              </Space>
            ),
          },
          {
            title: (
              <Space>
                <CertificationOutlined />
                <span>Keywords</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          marginTop: 28,
          marginBottom: 16,
          height: "calc(100vh - 92px)",
        }}
      >
        <ConfigProvider
          renderEmpty={() =>
            keywordsError ? (
              <ErrorBlock error={keywordsError} />
            ) : (
              <Empty description="No countries found" />
            )
          }
        >
          <Table
            style={{ width: "100%" }}
            rowKey={"id"}
            columns={columns}
            sticky={true}
            scroll={{ y: "calc(100vh - 187px)" }}
            dataSource={keywords}
            size={"small"}
            loading={keywordsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 50,
              size: "small",
              total: keywordsCount,
              showSizeChanger: false,
              showQuickJumper: true,
              showTotal: (total, range) => {
                return `${range[0]} to ${range[1]} of ${total}`;
              },
            }}
            onChange={(pagination, filters, sorter, extra) => {
              const s = sorter as Sorts;

              switch (extra.action) {
                case "paginate":
                  setKeywordsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setKeywordsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  setKeywordsPage(0);
                  break;
                case "filter":
                  break;
              }
            }}
          />
        </ConfigProvider>
      </Content>
    </>
  );
};

export default MetadataKeywordsPage;
