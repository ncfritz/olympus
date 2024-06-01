import { HomeOutlined } from "@ant-design/icons";
import {
  Breadcrumb,
  notification,
  Space,
  Table,
  type TableProps,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { type ReactNode, useEffect, useState } from "react";
import metadataApi, { type SortOptions } from "../../../api/metadataApi";
import Timestamp from "../../../components/data/Timestamp";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";

export interface Keyword {
  id: string;
  name: string;
  createdTime: string;
  lastUpdatedTime: string;
}

type OnChange = NonNullable<TableProps<Keyword>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type NotificationType = "success" | "info" | "warning" | "error";

const MetadataKeywordsPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [keywords, setKeywords] = useState<any>();
  const [keywordsLoading, setKeywordsLoading] = useState<any>(true);
  const [keywordsError, setKeywordsError] = useState<any>();
  const [keywordsCount, setKeywordsCount] = useState(0);
  const [keywordsPage, setKeywordsPage] = useState(0);
  const [keywordsSort, setKeywordsSort] = useState<SortOptions>({
    field: "id",
    order: "asc",
  });

  const openNotificationWithIcon = (
    type: NotificationType,
    message: string,
    content: ReactNode,
  ) => {
    api[type]({
      message: message,
      description: content,
    });
  };

  const fetchKeywords = async (quiet = false) => {
    if (!quiet) {
      setKeywordsLoading(true);
    }
    setKeywordsError(undefined);

    try {
      const listkeywordsResponse = await metadataApi.listKeywords(
        keywordsPage,
        keywordsSort,
      );
      setKeywords(listkeywordsResponse.data.keywords);
      setKeywordsCount(listkeywordsResponse.data.count);
    } catch (e) {
      setKeywordsError(e);
      openNotificationWithIcon("error", "Unable to load keywords list", "Poop");
    } finally {
      setKeywordsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchKeywords();
    })();
  }, [keywordsPage, keywordsSort]);

  const columns: ColumnsType<Keyword> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
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
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography>{record.name}</Typography>
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
      <Breadcrumb
        style={{ padding: 8, background: "#f6f6f6" }}
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
          background: "#fff",
        }}
      >
        <Content
          style={{
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          <Table
            style={{ width: "100%" }}
            rowKey={"id"}
            columns={columns}
            dataSource={keywords}
            size={"middle"}
            loading={keywordsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 20,
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
                  break;
                case "filter":
                  break;
              }
            }}
          />
        </Content>
      </Content>
    </>
  );
};

export default MetadataKeywordsPage;
