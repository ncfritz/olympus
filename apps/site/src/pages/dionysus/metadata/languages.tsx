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
import ReactCountryFlag from "react-country-flag/src";
import metadataApi, { type SortOptions } from "../../../api/metadataApi";
import Timestamp from "../../../components/data/Timestamp";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";

export interface Language {
  id: string;
  name: string;
  nativeName: string;
  createdTime: string;
  lastUpdatedTime: string;
}

type OnChange = NonNullable<TableProps<Language>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type NotificationType = "success" | "info" | "warning" | "error";

const MetadataLanguagesPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [languages, setLanguages] = useState<any>();
  const [languagesLoading, setLanguagesLoading] = useState<any>(true);
  const [languagesError, setLanguagesError] = useState<any>();
  const [languagesCount, setLanguagesCount] = useState(0);
  const [languagesPage, setLanguagesPage] = useState(0);
  const [languagesSort, setLanguagesSort] = useState<SortOptions>({
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

  const fetchLanguages = async (quiet = false) => {
    if (!quiet) {
      setLanguagesLoading(true);
    }
    setLanguagesError(undefined);

    try {
      const listlanguagesResponse = await metadataApi.listLanguages(
        languagesPage,
        languagesSort,
      );
      setLanguages(listlanguagesResponse.data.languages);
      setLanguagesCount(listlanguagesResponse.data.count);
    } catch (e) {
      setLanguagesError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load languages list",
        "Poop",
      );
    } finally {
      setLanguagesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchLanguages();
    })();
  }, [languagesPage, languagesSort]);

  const columns: ColumnsType<Language> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <ReactCountryFlag
              countryCode={record.id}
              cdnUrl={"/flags/"}
              cdnSuffix={"svg"}
              svg={true}
            />
            <Typography>{record.id.toUpperCase()}</Typography>
          </Space>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "name",
      title: "Name",
      dataIndex: "name",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography>{record.name}</Typography>
          </Space>
        );
      },
      sorter: true,
      width: 350,
    },
    {
      key: "nativeName",
      title: "Native Name",
      dataIndex: "nativeName",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography>{record.nativeName}</Typography>
          </Space>
        );
      },
      sorter: true,
    },
    {
      key: "created_at",
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
                <span>Languages</span>
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
            dataSource={languages}
            size={"middle"}
            loading={languagesLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 20,
              size: "small",
              total: languagesCount,
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
                  setLanguagesPage(pagination.current! - 1);
                  break;
                case "sort":
                  setLanguagesSort({
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

export default MetadataLanguagesPage;
