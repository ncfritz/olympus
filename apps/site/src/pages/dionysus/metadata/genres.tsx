import { HomeOutlined } from "@ant-design/icons";
import type { Genre, FilterDefinition } from "@ncfritz/olympus-sdk/dionysus";
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

type OnChange = NonNullable<TableProps<Genre>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataGenresPage: React.FunctionComponent = () => {
  const [genresCount, setGenresCount] = useState(0);
  const [genresPage, setGenresPage] = useState(0);
  const [genresSort, setGenresSort] = useState<SortOptions>({
    field: "id",
    order: "asc",
  });
  const [genreFilters, setGenreFilters] = useState<
    FilterDefinition | undefined
  >(undefined);

  const [genres, genresLoading, genresError] = useFetch<undefined, Genre[]>({
    dataType: "genres",
    watch: [genresPage, genresSort, genreFilters],
    params: undefined,
    fetchFunction: async () => {
      const response = await metadataApi.listGenres(
        genresPage,
        genresSort,
        genreFilters,
      );
      setGenresCount(response.data.count);
      return response.data.genres;
    },
  });

  const columns: ColumnsType<Genre> = [
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
                <span>Genres</span>
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
              genresError ? (
                <ErrorBlock error={genresError} />
              ) : (
                <Empty description="No genres found" />
              )
            }
          >
            <Table
              style={{ width: "100%" }}
              rowKey={(record) => {
                return `${record.id}-${record.type}`;
              }}
              columns={columns}
              sticky={true}
              scroll={{ y: "calc(100vh - 197px)" }}
              dataSource={genres}
              size={"small"}
              loading={genresLoading}
              pagination={{
                style: {
                  marginLeft: 16,
                },
                position: ["bottomLeft"],
                pageSize: 50,
                size: "small",
                total: genresCount,
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
                    setGenresPage(pagination.current! - 1);
                    break;
                  case "sort":
                    setGenresSort({
                      field: s.columnKey?.toString() || "",
                      order: s.order === "ascend" ? "asc" : "desc",
                    });
                    setGenresPage(0);
                    break;
                  case "filter":
                    setGenresPage(0);
                    setGenreFilters(buildFilterDefinitionForTable(filters));
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

export default MetadataGenresPage;
