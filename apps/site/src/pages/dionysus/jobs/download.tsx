import { HomeOutlined } from "@ant-design/icons";
import type {
  Certification,
  FilterDefinition,
  DecoratedMediaAssetDownload,
} from "@ncfritz/olympus-sdk/dionysus";
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
import mediaApi from "../../../api/mediaApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import Timestamp from "../../../components/data/Timestamp";
import { getMediaAssetDownloadStatusIndicator } from "../../../components/dionysus/media/utils";
import StepProgress from "../../../components/dionysus/media/workflow/StepProgress";
import { getPoster } from "../../../components/dionysus/metadata/util";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined } from "../../../icons";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const DownloadsPage: React.FunctionComponent = () => {
  const [downloadsCount, setDownloadsCount] = useState(0);
  const [downloadsPage, setDownloadsPage] = useState(0);
  const [downloadsSort, setDownloadsSort] = useState<SortOptions>({
    field: "startedTime",
    order: "asc",
  });
  const [downloadsFilters, setDownloadsFilters] = useState<
    FilterDefinition | undefined
  >(undefined);

  const [downloads, downloadsLoading, downloadsError] = useFetch<
    undefined,
    DecoratedMediaAssetDownload[]
  >({
    dataType: "downloads",
    watch: [downloadsPage, downloadsSort, downloadsFilters],
    params: undefined,
    fetchFunction: async () => {
      const response = await mediaApi.listMediaAssetDownloads(
        downloadsPage,
        48,
        downloadsSort,
        downloadsFilters,
      );
      setDownloadsCount(response.data.count);
      return response.data.downloads;
    },
  });

  const columns: ColumnsType<DecoratedMediaAssetDownload> = [
    {
      key: "assetType",
      title: "Media",
      dataIndex: "assetType",
      render: (value, record) => {
        let link;

        if (record.type === "movie") {
          link = `/dionysus/movies/${record.mediaId}?tab=sr`;
        } else if (record.type === "tv_series") {
          link = `/dionysus/tv/series/${record.decoration.seriesId}?tab=sr`;
        } else if (record.type === "tv_season") {
          link = `/dionysus/tv/series/${record.decoration.seriesId}/season/${record.decoration.seasonNumber}?tab=sr`;
        } else if (record.type === "tv_episode") {
          link = `/dionysus/tv/series/${record.decoration.seriesId}/season/${record.decoration.seasonNumber}/episode/${record.decoration.episodeNumber}?tab=sr`;
        }

        return (
          <Space
            orientation={"horizontal"}
            size={8}
            style={{ alignItems: "start", width: "100%" }}
            className={"person-fix"}
          >
            {getPoster(record.decoration.posterPath, "vertical", 64, 4)}
            <Space
              orientation={"vertical"}
              size={0}
              style={{
                width: "100%",
                justifyContent: "space-between",
                display: "flex",
              }}
            >
              <Link href={link!}>
                <Space
                  orientation={"vertical"}
                  size={0}
                  styles={{ item: { lineHeight: "11px" } }}
                >
                  <Typography.Text strong={true} style={{ fontSize: "12px" }}>
                    {record.type === "movie"
                      ? record.decoration.name
                      : record.decoration.seriesName}
                  </Typography.Text>
                  {["tv_season", "tv_episode"].includes(record.type) &&
                    record.decoration.seasonNumber && (
                      <Typography.Text style={{ fontSize: "11px" }}>
                        Season {record.decoration.seasonNumber}
                      </Typography.Text>
                    )}
                  {record.type === "tv_episode" &&
                    record.decoration.episodeNumber && (
                      <Typography.Text style={{ fontSize: "11px" }}>
                        Episode {record.decoration.episodeNumber}:{" "}
                        {record.decoration.name}
                      </Typography.Text>
                    )}
                </Space>
              </Link>
            </Space>
          </Space>
        );
      },
      filters: [
        {
          text: "Movie",
          value: "movie",
        },
        {
          text: "TV Series",
          value: "tv_series",
        },
        {
          text: "TV Season",
          value: "tv_season",
        },
        {
          text: "TV Episode",
          value: "tv_episode",
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: (a, b) => a.decoration.name.localeCompare(b.decoration.name),
      width: 500,
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
      render: (value, record) => {
        return getMediaAssetDownloadStatusIndicator(record.status);
      },
      filters: [
        {
          text: getMediaAssetDownloadStatusIndicator("pending"),
          value: "pending",
        },
        {
          text: getMediaAssetDownloadStatusIndicator("downloading"),
          value: "downloading",
        },
        {
          text: getMediaAssetDownloadStatusIndicator("success"),
          value: "success",
        },
        {
          text: getMediaAssetDownloadStatusIndicator("failed"),
          value: "failed",
        },
        {
          text: getMediaAssetDownloadStatusIndicator("cancelled"),
          value: "cancelled",
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 140,
    },
    {
      key: "progress",
      title: "Progress",
      dataIndex: "progress",
      render: (value, record) => {
        return (
          <StepProgress
            step={record}
            showTiming={false}
            progressSize={{ height: 3, width: 550 }}
          />
        );
      },
    },
    {
      key: "startedTime",
      title: "Started",
      dataIndex: "startedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 150,
    },
    {
      key: "finishedTime",
      title: "Finished",
      dataIndex: "finishedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 150,
    },
    {
      key: "createdTime",
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 150,
    },
    {
      key: "last_updated_at",
      title: "Last Updated",
      dataIndex: "lastUpdatedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 150,
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
              <Space>
                <CertificationOutlined />
                <span>Downloads</span>
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
            downloadsError ? (
              <ErrorBlock error={downloadsError} />
            ) : (
              <Empty description="No certifications found" />
            )
          }
        >
          <Table
            style={{ width: "100%" }}
            rowKey={(record) => `${record.type}-${record.mediaId}`}
            columns={columns}
            sticky={true}
            scroll={{ y: "calc(100vh - 187px)" }}
            dataSource={downloads}
            size={"small"}
            loading={downloadsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 50,
              size: "small",
              total: downloadsCount,
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
                  setDownloadsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setDownloadsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  setDownloadsPage(0);
                  break;
                case "filter":
                  setDownloadsPage(0);
                  setDownloadsFilters(buildFilterDefinitionForTable(filters));
                  break;
              }
            }}
          />
        </ConfigProvider>
      </Content>
    </>
  );
};

export default DownloadsPage;
