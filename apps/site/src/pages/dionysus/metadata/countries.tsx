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
import {
  CertificationOutlined,
  MetadataOutlinedIcon,
} from "../../../icons";

export interface Country {
  id: string;
  name: string;
  createdTime: string;
  lastUpdatedTime: string;
}

type OnChange = NonNullable<TableProps<Country>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type NotificationType = "success" | "info" | "warning" | "error";

const MetadataCountriesPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [countries, setCountries] = useState<any>();
  const [countriesLoading, setCountriesLoading] = useState<any>(true);
  const [countriesError, setCountriesError] = useState<any>();
  const [countriesCount, setCountriesCount] = useState(0);
  const [countriesPage, setCountriesPage] = useState(0);
  const [countriesSort, setCountriesSort] = useState<SortOptions>({
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

  const fetchCountries = async (quiet = false) => {
    if (!quiet) {
      setCountriesLoading(true);
    }
    setCountriesError(undefined);

    try {
      const listcountriesResponse = await metadataApi.listCountries(
        countriesPage,
        countriesSort,
      );
      setCountries(listcountriesResponse.data.countries);
      setCountriesCount(listcountriesResponse.data.count);
    } catch (e) {
      setCountriesError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load countries list",
        "Poop",
      );
    } finally {
      setCountriesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchCountries();
    })();
  }, [countriesPage, countriesSort]);

  const columns: ColumnsType<Country> = [
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
            <Typography>{record.id}</Typography>
          </Space>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "name",
      title: "Name",
      dataIndex: "Name",
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
                <span>Countries</span>
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
            dataSource={countries}
            size={"middle"}
            loading={countriesLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 20,
              size: "small",
              total: countriesCount,
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
                  setCountriesPage(pagination.current! - 1);
                  break;
                case "sort":
                  setCountriesSort({
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

export default MetadataCountriesPage;
