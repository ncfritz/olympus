import { HomeOutlined } from "@ant-design/icons";
import type {
  Certification,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
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
import { useFetch } from "../../../hooks/useFetch";
import {
  CertificationOutlined,
  MetadataOutlinedIcon,
  MovieIcon,
  TvIcon,
} from "../../../icons";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataCertificationsPage: React.FunctionComponent = () => {
  const [certificationsCount, setCertificationsCount] = useState(0);
  const [certificationsPage, setCertificationsPage] = useState(0);
  const [certificationsSort, setCertificationsSort] = useState<SortOptions>({
    field: "country",
    order: "asc",
  });
  const [certificationsFilters, setCertificationsFilters] = useState<
    FilterDefinition | undefined
  >(undefined);

  const [certifications, certificationsLoading, certificationsError] = useFetch<
    undefined,
    Certification[]
  >({
    dataType: "certifications",
    watch: [certificationsPage, certificationsSort, certificationsFilters],
    params: undefined,
    fetchFunction: async () => {
      const response = await metadataApi.listCertifications(
        certificationsPage,
        certificationsSort,
        certificationsFilters,
      );
      setCertificationsCount(response.data.count);
      return response.data.certifications;
    },
  });

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
      filters: [
        {
          text: (
            <Space direction={"horizontal"} size={8} align={"center"}>
              <MovieIcon />
              <Typography.Text>Movie</Typography.Text>
            </Space>
          ),
          value: "Movie",
        },
        {
          text: (
            <Space direction={"horizontal"} size={8} align={"center"}>
              <TvIcon />
              <Typography.Text>TV</Typography.Text>
            </Space>
          ),
          value: "TV",
        },
      ],
      filterMode: "tree",
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
      width: 125,
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
            height: "calc(100vh - 118px)",
          }}
        >
          <ConfigProvider
            renderEmpty={() =>
              certificationsError ? (
                <ErrorBlock error={certificationsError} />
              ) : (
                <Empty description="No certifications found" />
              )
            }
          >
            <Table
              style={{ width: "100%" }}
              rowKey={"id"}
              columns={columns}
              sticky={true}
              scroll={{ y: "calc(100vh - 197px)" }}
              dataSource={certifications}
              size={"small"}
              loading={certificationsLoading}
              pagination={{
                style: {
                  marginLeft: 16,
                },
                position: ["bottomLeft"],
                pageSize: 50,
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
                    setCertificationsPage(0);
                    break;
                  case "filter":
                    setCertificationsPage(0);
                    setCertificationsFilters(
                      buildFilterDefinitionForTable(filters),
                    );
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

export default MetadataCertificationsPage;
