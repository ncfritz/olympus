import {
  CloseCircleFilled,
  HomeOutlined,
  HourglassOutlined,
} from "@ant-design/icons";
import type {
  FilterDefinition,
  MediaAssetWorkflowListItem,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  ConfigProvider,
  Empty,
  Image,
  Progress,
  Space,
  Steps,
  Table,
  type TableProps,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import type { SortOptions } from "../../../api/common";
import mediaApi from "../../../api/mediaApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import Timestamp from "../../../components/data/Timestamp";
import SearchResultTag from "../../../components/dionysus/media/SearchResultTag";
import {
  getDownloadProgressLabel,
  getDownloadStepProperties,
  getStepProperties,
} from "../../../components/dionysus/media/utils";
import { getWorkflowStatusColor } from "../../../components/dionysus/media/workflow/util";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined, MovieIcon, TvIcon } from "../../../icons";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<MediaAssetWorkflowListItem>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();

  const [workflowsCount, setWorkflowsCount] = useState(0);
  const [workflowsPage, setWorkflowsPage] = useState(0);
  const [workflowsSort, setWorkflowsSort] = useState<SortOptions>({
    field: "createdTime",
    order: "desc",
  });
  const [workflowsFilters, setWorkflowsFilters] = useState<
    FilterDefinition | undefined
  >(undefined);

  const [workflows, workflowsLoading, workflowsError] = useFetch<
    undefined,
    MediaAssetWorkflowListItem[]
  >({
    dataType: "workflows",
    watch: [workflowsPage, workflowsSort, workflowsFilters],
    params: undefined,
    fetchFunction: async () => {
      const response = await mediaApi.listMediaAssetWorkflows(
        workflowsPage,
        30,
        workflowsSort,
        workflowsFilters,
      );
      setWorkflowsCount(response.data.count);
      return response.data.workflows;
    },
  });

  const columns: ColumnsType<MediaAssetWorkflowListItem> = [
    {
      key: "asset",
      title: "Asset",
      dataIndex: "country",
      render: (value, record) => {
        return (
          <Link href={`/dionysus/queue/${record.id}`}>
            <Space direction={"horizontal"} size={8} align={"center"}>
              <Image
                preview={false}
                style={{
                  height: 60,
                  width: 45,
                  borderRadius: 8,
                  margin: 4,
                }}
                src={`https://image.tmdb.org/t/p/w342/${record.decoration.posterPath}}`}
                alt={"Poster"}
              />
              <Space
                direction={"vertical"}
                size={0}
                style={{ display: "flex", alignItems: "start" }}
              >
                <Typography.Title
                  level={5}
                  style={{ marginBottom: 3, lineHeight: "12px" }}
                >
                  {record.type === "movie" ? <MovieIcon /> : <TvIcon />}
                  &nbsp;{record.decoration.name}
                </Typography.Title>
                {record.type === "tv_episode" && (
                  <Typography.Text style={{ lineHeight: "12px" }}>
                    {record.decoration.seriesName} - Season{" "}
                    {record.decoration.seasonNumber} - Episode{" "}
                    {record.decoration.episodeNumber}
                  </Typography.Text>
                )}
                <Typography.Text
                  style={{
                    fontSize: 11,
                    color: "#666666",
                    fontFamily: "monospace",
                  }}
                >
                  {record.id}
                </Typography.Text>
              </Space>
            </Space>
          </Link>
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
          value: "movie",
        },
        {
          text: (
            <Space direction={"horizontal"} size={8} align={"center"}>
              <TvIcon />
              <Typography.Text>TV Episode</Typography.Text>
            </Space>
          ),
          value: "tv_episode",
        },
      ],
      filterMode: "tree",
      sorter: true,
      width: 400,
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} style={{ width: "100%" }}>
            <Typography.Text style={{ fontSize: 18, color: "#777777" }}>
              <SearchResultTag
                color={getWorkflowStatusColor(record.status)}
                monospace={true}
                style={{ width: 85, padding: 2 }}
              >
                {record.status}
              </SearchResultTag>
            </Typography.Text>
          </Space>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "download",
      title: "Download",
      dataIndex: "download",
      render: (value, record) => {
        const progressStatus = getDownloadProgressLabel(record.download.status);

        return (
          <Progress
            style={{ maxWidth: 230, marginBottom: 8 }}
            percent={record.download.progress}
            size={[230, 3]}
            status={progressStatus}
            format={(value) => `${value?.toFixed(2)}%`}
          />
        );
      },
      sorter: true,
      width: 250,
    },
    {
      key: "transcode",
      title: "Transcode",
      dataIndex: "transcode",
      render: (value, record) => {
        let content =
          record.download.status === "failed" ? (
            <Typography.Text style={{ fontSize: "12px", color: "#f34a4c" }}>
              <Space direction={"horizontal"} size={4} align={"center"}>
                <CloseCircleFilled />
                Transcode skipped...
              </Space>
            </Typography.Text>
          ) : (
            <Typography.Text style={{ fontSize: "12px", color: "#999999" }}>
              <Space direction={"horizontal"} size={4} align={"center"}>
                <HourglassOutlined />
                Transcode pending...
              </Space>
            </Typography.Text>
          );
        const transcodeStep = record.steps.find((s) => s.type === "transcode");

        if (transcodeStep) {
          const progressStatus = getDownloadProgressLabel(
            record.download.status,
          );

          content = (
            <Progress
              style={{ maxWidth: 230, marginBottom: 8 }}
              percent={transcodeStep.progress}
              size={[230, 3]}
              status={progressStatus}
              format={(value) => `${value?.toFixed(2)}%`}
            />
          );
        }

        return content;
      },
      sorter: true,
      width: 250,
    },
    {
      key: "workflow",
      title: "Steps",
      dataIndex: "workflow",
      className: "table-cell-center-align",
      render: (value, record) => {
        return (
          <Steps
            type={"inline"}
            className={"dionysus-workflow-inline"}
            onChange={async (current) => {
              await router.push(
                `/dionysus/queue/${record.id}?step=${current}`,
                `/dionysus/queue/${record.id}?step=${current}`,
                { shallow: true },
              );
            }}
            items={[
              {
                title: "Download",
                description: "Fetch source from Usenet",
                ...getDownloadStepProperties(record.download, false),
              },
              {
                title: "Original MD",
                description: "Extract original metadata",
                ...getStepProperties(record.steps, "extract_original_metadata"),
              },
              {
                title: "Configure",
                description: "Determine audio/subtitle tracks",
                ...getStepProperties(record.steps, "configure_transcode"),
              },
              {
                title: "Verify",
                description: "Verify audio/subtitle output",
                ...getStepProperties(record.steps, "verify_transcode"),
              },
              {
                title: "Transcode",
                description: "Transcode source",
                ...getStepProperties(record.steps, "transcode"),
              },
              {
                title: "Transcode MD",
                description: "Extract transcoded metadata",
                ...getStepProperties(record.steps, "extract_new_metadata"),
              },
              {
                title: "Upload",
                ...getStepProperties(record.steps, "upload"),
              },
              {
                title: "Cleanup",
                ...getStepProperties(record.steps, "cleanup"),
              },
            ]}
          />
        );
      },
      sorter: false,
    },
    {
      key: "startedTime",
      title: "Started",
      dataIndex: "startedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 120,
    },
    {
      key: "finishedTime",
      title: "Finished",
      dataIndex: "finishedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 120,
    },
    {
      key: "createdTime",
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 120,
    },
    {
      key: "last_updated_at",
      title: "Last Updated",
      dataIndex: "lastUpdatedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 140,
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
                <span>Processing Queue</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          marginTop: 28,
          marginBottom: 16,
          height: "calc(100vh - 118px)",
        }}
      >
        <ConfigProvider
          renderEmpty={() =>
            workflowsError ? (
              <ErrorBlock error={workflowsError} />
            ) : (
              <Empty description="No workflows found" />
            )
          }
        >
          <Table
            style={{ width: "100%" }}
            rowKey={"id"}
            columns={columns}
            sticky={true}
            scroll={{ y: "calc(100vh - 197px)" }}
            dataSource={workflows}
            size={"small"}
            loading={workflowsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 50,
              size: "small",
              total: workflowsCount,
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
                  setWorkflowsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setWorkflowsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  setWorkflowsPage(0);
                  break;
                case "filter":
                  setWorkflowsPage(0);
                  setWorkflowsFilters(buildFilterDefinitionForTable(filters));
                  break;
              }
            }}
          />
        </ConfigProvider>
      </Content>
    </>
  );
};

export default IndexPage;
