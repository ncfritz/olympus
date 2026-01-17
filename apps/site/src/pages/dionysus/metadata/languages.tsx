import { HomeOutlined } from "@ant-design/icons";
import type { Language } from "@ncfritz/olympus-sdk/dionysus";
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
import ReactCountryFlag from "react-country-flag/src";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import Timestamp from "../../../components/data/Timestamp";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";

type OnChange = NonNullable<TableProps<Language>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataLanguagesPage: React.FunctionComponent = () => {
  const [languagesCount, setLanguagesCount] = useState(0);
  const [languagesPage, setLanguagesPage] = useState(0);
  const [languagesSort, setLanguagesSort] = useState<SortOptions>({
    field: "id",
    order: "asc",
  });

  const [languages, languagesLoading, languagesError] = useFetch<
    undefined,
    Language[]
  >({
    dataType: "countries",
    watch: [languagesPage, languagesSort],
    params: undefined,
    fetchFunction: async () => {
      const response = await metadataApi.listLanguages(
        languagesPage,
        languagesSort,
      );
      setLanguagesCount(response.data.count);
      return response.data.languages;
    },
  });

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
      <OlympusBreadcrumbs
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
            height: "calc(100vh - 118px)",
          }}
        >
          <ConfigProvider
            renderEmpty={() =>
              languagesError ? (
                <ErrorBlock error={languagesError} />
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
              scroll={{ y: "calc(100vh - 197px)" }}
              dataSource={languages}
              size={"small"}
              loading={languagesLoading}
              pagination={{
                style: {
                  marginLeft: 16,
                },
                position: ["bottomLeft"],
                pageSize: 50,
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
                    setLanguagesPage(0);
                    break;
                  case "filter":
                    break;
                }
              }}
            />
          </ConfigProvider>
        </Content>
      </Content>
    </>
  );
};

export default MetadataLanguagesPage;
