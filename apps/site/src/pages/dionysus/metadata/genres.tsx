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
import {
  CertificationOutlined,
  MetadataOutlinedIcon,
  MovieIcon,
  TvIcon,
} from "../../../icons";

export interface Genre {
  id: string;
  name: string;
  type: GenreType;
  createdTime: string;
  lastUpdatedTime: string;
}

type OnChange = NonNullable<TableProps<Genre>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type GenreType = "TV" | "Movie";
type NotificationType = "success" | "info" | "warning" | "error";

const MetadataGenresPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [genres, setGenres] = useState<any>();
  const [genresLoading, setGenresLoading] = useState<any>(true);
  const [genresError, setGenresError] = useState<any>();
  const [genresCount, setGenresCount] = useState(0);
  const [genresPage, setGenresPage] = useState(0);
  const [genresSort, setGenresSort] = useState<SortOptions>({
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

  const fetchGenres = async (quiet = false) => {
    if (!quiet) {
      setGenresLoading(true);
    }
    setGenresError(undefined);

    try {
      const listGenresResponse = await metadataApi.listGenres(
        genresPage,
        genresSort,
      );
      setGenres(listGenresResponse.data.genres);
      setGenresCount(listGenresResponse.data.count);
    } catch (e) {
      setGenresError(e);
      openNotificationWithIcon("error", "Unable to load genres list", "Poop");
    } finally {
      setGenresLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchGenres();
    })();
  }, [genresPage, genresSort]);

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
          }}
        >
          <Table
            style={{ width: "100%" }}
            rowKey={(record) => {
              return `${record.id}-${record.type}`;
            }}
            columns={columns}
            dataSource={genres}
            size={"middle"}
            loading={genresLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 20,
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

export default MetadataGenresPage;
