import { HomeOutlined } from "@ant-design/icons";
import type {
  Certification,
  FilterDefinition,
  MediaAssetSearchConfigurationListItem,
  SearchExecutionStatus,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Badge,
  ConfigProvider,
  Empty,
  Space,
  Table,
  type TableProps,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import { Content } from "antd/lib/layout/layout";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useState } from "react";
import type { SortOptions } from "../../../api/common";
import mediaApi from "../../../api/mediaApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import Timestamp from "../../../components/data/Timestamp";
import SearchExecutionsResultsSparklineChart from "../../../components/dionysus/media/graphs/SearchExecutionsResultsSparklineChart";
import SearchExecutionsRuntimeSparklineChart from "../../../components/dionysus/media/graphs/SearchExecutionsRuntimeSparklineChart";
import {
  getMediaAssetSearchConfigurationStatusIndicator,
  getMediaAssetSearchExecutionStatusColor,
  getMediaAssetSearchExecutionStatusIndicator,
} from "../../../components/dionysus/media/utils";
import { getPoster } from "../../../components/dionysus/metadata/util";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined } from "../../../icons";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const SearchConfigurationsPage: React.FunctionComponent = () => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [searchConfigurationsCount, setSearchConfigurationsCount] = useState(0);
  const [searchConfigurationsPage, setSearchConfigurationsPage] = useState(0);
  const [searchConfigurationsSort, setSearchConfigurationsSort] =
    useState<SortOptions>({
      field: "lastExecutionTime",
      order: "asc",
    });
  const [searchConfigurationsFilters, setSearchConfigurationsFilters] =
    useState<FilterDefinition | undefined>(undefined);

  const [
    searchConfigurations,
    searchConfigurationsLoading,
    searchConfigurationsError,
  ] = useFetch<undefined, MediaAssetSearchConfigurationListItem[]>({
    dataType: "search configurations",
    watch: [
      searchConfigurationsPage,
      searchConfigurationsSort,
      searchConfigurationsFilters,
    ],
    params: undefined,
    fetchFunction: async () => {
      const response = await mediaApi.listMediaAssetSearchConfigurations(
        searchConfigurationsPage,
        48,
        searchConfigurationsSort,
        searchConfigurationsFilters,
      );
      setSearchConfigurationsCount(response.data.count);
      return response.data.searchConfigurations;
    },
  });

  const columns: ColumnsType<MediaAssetSearchConfigurationListItem> = [
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
            <div
              style={{ cursor: "pointer" }}
              onClick={() => {
                const key = `${record.type}-${record.mediaId}`;
                console.log(expandedRowKeys);

                setExpandedRowKeys((prev) => {
                  return prev.includes(key)
                    ? prev.filter((k) => k !== key)
                    : [...prev, key];
                });
              }}
            >
              {getPoster(record.decoration.posterPath, "vertical", 64, 4)}
            </div>
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
    },
    {
      key: "enabled",
      title: "Enabled",
      dataIndex: "enabled",
      render: (value, record) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
            {record.enabled ? (
              <Badge status="success" text="Enabled" />
            ) : (
              <Badge status="default" text="Disabled" />
            )}
          </Space>
        );
      },
      filters: [
        {
          text: "Enabled",
          value: true,
        },
        {
          text: "Disabled",
          value: false,
        },
      ],
      sorter: true,
      width: 120,
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
      render: (value, record) => {
        return getMediaAssetSearchConfigurationStatusIndicator(record.status);
      },
      filters: [
        {
          text: getMediaAssetSearchConfigurationStatusIndicator("running"),
          value: "running",
        },
        {
          text: getMediaAssetSearchConfigurationStatusIndicator("ok"),
          value: "ok",
        },
        {
          text: getMediaAssetSearchConfigurationStatusIndicator("error"),
          value: "error",
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 140,
    },
    {
      key: "backoff",
      title: "Backoff",
      dataIndex: "backoff",
      render: (value, record) => {
        return (
          <Typography.Text
            style={{ fontFamily: "monospace", fontSize: "12px" }}
          >
            {record.backoff}
          </Typography.Text>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "jitter",
      title: "Jitter",
      dataIndex: "jitter",
      render: (value, record) => {
        return (
          <Typography.Text
            style={{ fontFamily: "monospace", fontSize: "12px" }}
          >
            {record.jitter}
          </Typography.Text>
        );
      },
      sorter: false,
      width: 100,
    },
    {
      key: "executionStatus",
      title: "Execution Status",
      dataIndex: "undefined",
      className: "vcenter",
      render: (value, record) => {
        const stats: (SearchExecutionStatus | "none")[] = [];

        for (let i = 0; i < 30; i++) {
          if (record.executions.length > i) {
            stats.unshift(record.executions[i].status);
          } else {
            stats.unshift("none");
          }
        }

        return (
          <Space
            orientation={"horizontal"}
            size={2}
            style={{ width: "100%", height: 32 }}
          >
            {stats.map((status) => (
              <div
                style={{
                  width: 3,
                  backgroundColor:
                    getMediaAssetSearchExecutionStatusColor(status),
                  height: 24,
                }}
              ></div>
            ))}
          </Space>
        );
      },
      sorter: false,
      width: 180,
    },
    {
      key: "runtime",
      title: "Runtime",
      dataIndex: "undefined",
      className: "vcenter",
      render: (value, record) => {
        const stats = [];

        for (let i = 0; i < 30; i++) {
          if (record.executions.length > i) {
            if (
              !record.executions[i].startedTime ||
              !record.executions[i].finishedTime
            ) {
              stats.unshift(0);
              continue;
            }

            const start = DateTime.fromISO(record.executions[i].startedTime);
            const end = DateTime.fromISO(record.executions[i].finishedTime!);

            stats.unshift(end.diff(start).milliseconds);
          } else {
            stats.unshift(0);
          }
        }

        return <SearchExecutionsRuntimeSparklineChart stats={stats} />;
      },
      sorter: false,
      width: 180,
    },
    {
      key: "runtime",
      title: "Runtime",
      dataIndex: "undefined",
      className: "vcenter",
      render: (value, record) => {
        const stats = {
          new: new Array(30).fill(0),
          duplicate: new Array(30).fill(0),
          skipped: new Array(30).fill(0),
        };

        for (let i = 0; i < 30; i++) {
          if (record.executions.length > i) {
            stats.new[30 - i] = record.executions[i].newRecords;
            stats.duplicate[30 - i] = record.executions[i].duplicateRecords;
            stats.skipped[30 - i] = record.executions[i].skippedRecords;
          }
        }

        return <SearchExecutionsResultsSparklineChart stats={stats} />;
      },
      sorter: false,
      width: 270,
    },
    {
      key: "lastExecutionTime",
      title: "Last Execution",
      dataIndex: "lastExecutionTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 150,
    },
    {
      key: "nextExecutionTime",
      title: "Next Execution",
      dataIndex: "nextExecutionTime",
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
                <span>Search Configurations</span>
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
            searchConfigurationsError ? (
              <ErrorBlock error={searchConfigurationsError} />
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
            dataSource={searchConfigurations}
            size={"small"}
            loading={searchConfigurationsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 50,
              size: "small",
              total: searchConfigurationsCount,
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
                  setSearchConfigurationsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setSearchConfigurationsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  setSearchConfigurationsPage(0);
                  break;
                case "filter":
                  setSearchConfigurationsPage(0);
                  setSearchConfigurationsFilters(
                    buildFilterDefinitionForTable(filters),
                  );
                  break;
              }
            }}
            expandable={{
              showExpandColumn: false,
              expandedRowKeys: expandedRowKeys,
              onExpandedRowsChange: (keys) =>
                setExpandedRowKeys(keys as React.Key[]),
              expandedRowRender: (record) => {
                return (
                  <Table
                    style={{ width: "100%" }}
                    rowKey={"id"}
                    size={"small"}
                    dataSource={record.executions}
                    pagination={false}
                    scroll={{ y: "350px" }}
                    columns={[
                      {
                        key: "id",
                        title: "Execution ID",
                        dataIndex: "id",
                        render: (value) => {
                          return (
                            <Typography.Text
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              {value}
                            </Typography.Text>
                          );
                        },
                        width: 350,
                      },
                      {
                        key: "status",
                        title: "Status",
                        dataIndex: "status",
                        render: (value) => {
                          return getMediaAssetSearchExecutionStatusIndicator(
                            value,
                          );
                        },
                        width: 150,
                      },
                      {
                        key: "newRecords",
                        title: "New",
                        dataIndex: "newRecords",
                        render: (value) => {
                          return (
                            <Typography.Text
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              {value}
                            </Typography.Text>
                          );
                        },
                        sorter: true,
                        width: 100,
                      },
                      {
                        key: "duplicateRecords",
                        title: "Duplicate",
                        dataIndex: "duplicateRecords",
                        render: (value) => {
                          return (
                            <Typography.Text
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              {value}
                            </Typography.Text>
                          );
                        },
                        sorter: true,
                        width: 100,
                      },
                      {
                        key: "skippedRecords",
                        title: "Skipped",
                        dataIndex: "skippedRecords",
                        render: (value) => {
                          return (
                            <Typography.Text
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              {value}
                            </Typography.Text>
                          );
                        },
                        sorter: true,
                        width: 100,
                      },
                      {
                        key: "totalRecords",
                        title: "Total",
                        dataIndex: "totalRecords",
                        render: (value) => {
                          return (
                            <Typography.Text
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              {value}
                            </Typography.Text>
                          );
                        },
                        sorter: true,
                      },
                      {
                        key: "startedTime",
                        title: "Started Time",
                        dataIndex: "startedTime",
                        render: (value) => {
                          return (
                            <Timestamp
                              value={value}
                              showTime={true}
                              direction={"horizontal"}
                            />
                          );
                        },
                        sorter: true,
                        width: 200,
                      },
                      {
                        key: "finishedTime",
                        title: "Finished Time",
                        dataIndex: "finishedTime",
                        render: (value) => {
                          return (
                            <Timestamp
                              value={value}
                              showTime={true}
                              direction={"horizontal"}
                            />
                          );
                        },
                        sorter: true,
                        width: 200,
                      },
                      {
                        key: "createdTime",
                        title: "Created",
                        dataIndex: "createdTime",
                        render: (value) => {
                          return (
                            <Timestamp
                              value={value}
                              showTime={true}
                              direction={"horizontal"}
                            />
                          );
                        },
                        sorter: true,
                        width: 200,
                      },
                      {
                        key: "last_updated_at",
                        title: "Last Updated",
                        dataIndex: "lastUpdatedTime",
                        render: (value) => {
                          return (
                            <Timestamp
                              value={value}
                              showTime={true}
                              direction={"horizontal"}
                            />
                          );
                        },
                        sorter: true,
                        width: 200,
                      },
                    ]}
                  />
                );
              },
            }}
          />
        </ConfigProvider>
      </Content>
    </>
  );
};

export default SearchConfigurationsPage;
