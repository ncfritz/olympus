import { HomeOutlined } from "@ant-design/icons";
import type {
  Certification,
  FilterDefinition,
  DecoratedMediaAssetWorkflowStep,
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
import { getStepStatusIndicator } from "../../../components/dionysus/media/utils";
import StepProgress from "../../../components/dionysus/media/workflow/StepProgress";
import { getPoster } from "../../../components/dionysus/metadata/util";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined } from "../../../icons";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const TranscodesPage: React.FunctionComponent = () => {
  const [transcodesCount, setTranscodesCount] = useState(0);
  const [transcodesPage, setTranscodesPage] = useState(0);
  const [transcodesSort, setTranscodesSort] = useState<SortOptions>({
    field: "startedTime",
    order: "asc",
  });
  const [transcodesFilters, setTranscodesFilters] = useState<
    FilterDefinition | undefined
  >(undefined);

  const [transcodes, transcodesLoading, transcodesError] = useFetch<
    undefined,
    DecoratedMediaAssetWorkflowStep[]
  >({
    dataType: "downloads",
    watch: [transcodesPage, transcodesSort, transcodesFilters],
    params: undefined,
    fetchFunction: async () => {
      const response = await mediaApi.listMediaAssetTranscodes(
        transcodesPage,
        48,
        transcodesSort,
        transcodesFilters,
      );
      setTranscodesCount(response.data.count);
      return response.data.steps;
    },
  });

  const columns: ColumnsType<DecoratedMediaAssetWorkflowStep> = [
    {
      key: "assetType",
      title: "Media",
      dataIndex: "assetType",
      render: (value, record) => {
        let link;

        if (record.assetType === "movie") {
          link = `/dionysus/movies/${record.mediaId}?tab=sr`;
        } else if (record.assetType === "tv_series") {
          link = `/dionysus/tv/series/${record.decoration.seriesId}?tab=sr`;
        } else if (record.assetType === "tv_season") {
          link = `/dionysus/tv/series/${record.decoration.seriesId}/season/${record.decoration.seasonNumber}?tab=sr`;
        } else if (record.assetType === "tv_episode") {
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
                    {record.assetType === "movie"
                      ? record.decoration.name
                      : record.decoration.seriesName}
                  </Typography.Text>
                  {["tv_season", "tv_episode"].includes(record.assetType) &&
                    record.decoration.seasonNumber && (
                      <Typography.Text style={{ fontSize: "11px" }}>
                        Season {record.decoration.seasonNumber}
                      </Typography.Text>
                    )}
                  {record.assetType === "tv_episode" &&
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
        return getStepStatusIndicator(record.status);
      },
      filters: [
        {
          text: getStepStatusIndicator("pending"),
          value: "pending",
        },
        {
          text: getStepStatusIndicator("running"),
          value: "running",
        },
        {
          text: getStepStatusIndicator("success"),
          value: "success",
        },
        {
          text: getStepStatusIndicator("failed"),
          value: "failed",
        },
        {
          text: getStepStatusIndicator("skipped"),
          value: "skipped",
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
                <span>Media Transcodes</span>
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
            transcodesError ? (
              <ErrorBlock error={transcodesError} />
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
            dataSource={transcodes}
            size={"small"}
            loading={transcodesLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 50,
              size: "small",
              total: transcodesCount,
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
                  setTranscodesPage(pagination.current! - 1);
                  break;
                case "sort":
                  setTranscodesSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  setTranscodesPage(0);
                  break;
                case "filter":
                  setTranscodesPage(0);
                  setTranscodesFilters(buildFilterDefinitionForTable(filters));
                  break;
              }
            }}
          />
        </ConfigProvider>
      </Content>
    </>
  );
};

export default TranscodesPage;
