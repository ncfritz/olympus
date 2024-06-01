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
import { type SortOptions } from "../../../api/contentApi";
import metadataApi from "../../../api/metadataApi";
import Timestamp from "../../../components/data/Timestamp";
import {
  CertificationOutlined,
  MetadataOutlinedIcon,
  MovieIcon,
  TvIcon,
} from "../../../icons";

export interface Certification {
  country: string;
  certification: string;
  type: string;
  order: number;
  meaning: string;
  createdTime: string;
  lastUpdatedTime: string;
}

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type NotificationType = "success" | "info" | "warning" | "error";

const MetadataCertificationsPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [certifications, setCertifications] = useState<any>();
  const [certificationsLoading, setCertificationsLoading] = useState<any>(true);
  const [certificationsError, setCertificationsError] = useState<any>();
  const [certificationsCount, setCertificationsCount] = useState(0);
  const [certificationsPage, setCertificationsPage] = useState(0);
  const [certificationsSort, setCertificationsSort] = useState<SortOptions>({
    field: "country",
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

  const fetchAssets = async (quiet = false) => {
    if (!quiet) {
      setCertificationsLoading(true);
    }
    setCertificationsError(undefined);

    try {
      const listcertificationsResponse = await metadataApi.listCertifications(
        certificationsPage,
        certificationsSort,
      );
      setCertifications(listcertificationsResponse.data.certifications);
      setCertificationsCount(listcertificationsResponse.data.count);
    } catch (e) {
      setCertificationsError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load certifications list",
        "Poop",
      );
    } finally {
      setCertificationsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAssets();
    })();
  }, [certificationsPage, certificationsSort]);

  const columns: ColumnsType<Certification> = [
    {
      key: "country",
      title: "Country",
      dataIndex: "country",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <ReactCountryFlag
              countryCode={record.country}
              cdnUrl={"/flags/"}
              cdnSuffix={"svg"}
              svg={true}
            />
            <Typography>{record.country}</Typography>
          </Space>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "type",
      title: "Type",
      dataIndex: "type",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            {record.type === "Movie" ? <MovieIcon /> : <TvIcon />}
            <Typography.Text>{record.type}</Typography.Text>
          </Space>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "certification",
      title: "Certification",
      dataIndex: "certification",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontWeight: "bold" }}>
            {record.certification}
          </Typography.Text>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "meaning",
      title: "Description",
      dataIndex: "meaning",
      render: (value, record) => {
        return <Typography.Text>{record.meaning}</Typography.Text>;
      },
      sorter: false,
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
                <span>Certifications</span>
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
            dataSource={certifications}
            size={"middle"}
            loading={certificationsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 20,
              size: "small",
              total: certificationsCount,
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
                  setCertificationsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setCertificationsSort({
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

export default MetadataCertificationsPage;
