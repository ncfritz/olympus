import {
  CloseCircleFilled, CloseOutlined,
  HomeOutlined,
  HourglassOutlined, RedoOutlined,
  ReloadOutlined,
  SaveOutlined
} from "@ant-design/icons";
import type {
  FilterDefinition,
  MediaAssetWorkflowListItem,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  Col,
  ConfigProvider,
  Empty,
  Image,
  Progress,
  Row,
  Space,
  Statistic,
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
import RefreshTimer from "../../../components/common/RefreshTimer";
import Timestamp from "../../../components/data/Timestamp";
import {
  getDownloadProgressLabel,
  getDownloadStepProperties,
  getStepProperties,
} from "../../../components/dionysus/media/utils";
import { getWorkflowStatusIndicator } from "../../../components/dionysus/media/workflow/util";
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<
    MediaAssetWorkflowListItem[]
  >([]);
  const [processingRows, setProcessingRows] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    pending: 0,
    skipped: 0,
    success: 0,
    failed: 0,
    total: 0,
  });

  const [workflows, workflowsLoading, workflowsError, fetchWorkflows] =
    useFetch<undefined, MediaAssetWorkflowListItem[]>({
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

  const onSelectChange = (
    newSelectedRowKeys: React.Key[],
    newSelectedRows: MediaAssetWorkflowListItem[],
  ) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const deleteSelectedWorkflows = async () => {
    await processRows(async (job) => {
      await mediaApi.deleteMediaAssetWorkflow(job.id, false);
      return true;
    });
  };

  const reprocessSelectedWorkflows = async () => {
    await processRows(async (job) => {
      let resubmitted = false;

      if (job.download) {
        await mediaApi.createMediaAssetDownload(job.type, job.mediaId, job.download.searchResultId);
        resubmitted = true;
      }

      await mediaApi.deleteMediaAssetWorkflow(job.id, false);

      return resubmitted;
    });
  };

  const processRows = async (
    process: (job: MediaAssetWorkflowListItem) => Promise<boolean>,
  ) => {
    setProcessingRows(true);

    try {
      const currentStatus = {
        total: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        success: 0,
      };

      for (const value of selectedRows) {
        try {
          const processed = await process(value);

          if (processed) {
            currentStatus.success++;
          } else {
            currentStatus.skipped++;
          }
        } catch (e) {
          currentStatus.failed++;
        }

        currentStatus.total++;
        setProcessingStatus({ ...currentStatus });
      }
    } finally {
      await fetchWorkflows(true);
      setSelectedRowKeys([]);
      setProcessingRows(false);
      setProcessingStatus({
        total: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        success: 0,
      });
    }
  };

  const columns: ColumnsType<MediaAssetWorkflowListItem> = [
    {
      key: "asset",
      title: "Asset",
      dataIndex: "country",
      render: (value, record) => {
        return (
          <Link href={`/dionysus/queue/${record.id}`}>
            <Space orientation={"horizontal"} size={8} align={"center"}>
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
                orientation={"vertical"}
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
            <Space orientation={"horizontal"} size={8} align={"center"}>
              <MovieIcon />
              <Typography.Text>Movie</Typography.Text>
            </Space>
          ),
          value: "movie",
        },
        {
          text: (
            <Space orientation={"horizontal"} size={8} align={"center"}>
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
          <Space
            orientation={"horizontal"}
            size={8}
            style={{ width: "100%" }}
            styles={{ item: { width: "100%" } }}
          >
            <Typography.Text style={{ fontSize: 18, color: "#777777" }}>
              {getWorkflowStatusIndicator(record.status, true)}
            </Typography.Text>
          </Space>
        );
      },
      filters: [
        {
          text: getWorkflowStatusIndicator("queued", true),
          value: "queued",
        },
        {
          text: getWorkflowStatusIndicator("pending_input", true),
          value: "pending_input",
        },
        {
          text: getWorkflowStatusIndicator("running", true),
          value: "running",
        },
        {
          text: getWorkflowStatusIndicator("success", true),
          value: "success",
        },
        {
          text: getWorkflowStatusIndicator("failed", true),
          value: "failed",
        },
      ],
      filterMode: "tree",
      sorter: true,
      width: 160,
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
              <Space orientation={"horizontal"} size={4} align={"center"}>
                <CloseCircleFilled />
                Transcode skipped...
              </Space>
            </Typography.Text>
          ) : (
            <Typography.Text style={{ fontSize: "12px", color: "#999999" }}>
              <Space orientation={"horizontal"} size={4} align={"center"}>
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
            styles={{
              itemRail: { borderWidth: 1.5 },
              itemIcon: { borderWidth: 5, marginTop: 1 },
              itemSection: { width: 55 },
            }}
            items={[
              {
                title: "DL",
                ...getDownloadStepProperties(record.download, false),
              },
              {
                title: "Orig MD",
                ...getStepProperties(record.steps, "extract_original_metadata"),
              },
              {
                title: "Config",
                ...getStepProperties(record.steps, "configure_transcode"),
              },
              {
                title: "Verify",
                content: "Verify audio/subtitle output",
                ...getStepProperties(record.steps, "verify_transcode"),
              },
              {
                title: "Xcode",
                ...getStepProperties(record.steps, "transcode"),
              },
              {
                title: "New MD",
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

  let actionsContent = (
    <Col span={24} style={{ justifyContent: "space-between", display: "flex" }}>
      <Space
        orientation={"horizontal"}
        style={{ padding: 0, marginLeft: 16, marginRight: 16 }}
      >
        <Space
          orientation={"horizontal"}
          size={8}
          style={{
            alignItems: "center",
            borderRight: "1px solid #f3f3f3",
            padding: 16,
          }}
        >
          <Typography.Text strong={true}>Status: </Typography.Text>
          <Button
            type={"primary"}
            icon={<CloseOutlined />}
            danger={true}
            disabled={
              selectedRows.length <= 0 || processingRows || workflowsLoading
            }
            onClick={async () => {
              await deleteSelectedWorkflows();
            }}
          >
            Delete
          </Button>
          <Button
            type={"primary"}
            color={"cyan"}
            icon={<RedoOutlined />}
            disabled={
              selectedRows.length <= 0 || processingRows || workflowsLoading
            }
            onClick={async () => {
              await reprocessSelectedWorkflows();
            }}
          >
            Re-Process
          </Button>
        </Space>
      </Space>
      <Space style={{ marginRight: 16 }}>
        <Button
          type={"text"}
          disabled={workflowsLoading}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchWorkflows(true);
          }}
        />
      </Space>
    </Col>
  );

  if (processingRows) {
    actionsContent = (
      <Col span={24} style={{ padding: 16 }}>
        <Space
          orientation={"vertical"}
          size={16}
          style={{ marginLeft: 16, marginRight: 16, width: "100%" }}
        >
          <Progress
            size={"default"}
            percent={(processingStatus.total / selectedRowKeys.length) * 100}
            style={{ paddingRight: 32 }}
            format={(percent) => {
              return `${percent?.toFixed(0)}%`;
            }}
          />
          <Space orientation={"horizontal"} size={64}>
            <Statistic title={"To Publish"} value={selectedRows.length} />
            <Statistic title={"Success"} value={processingStatus.success} />
            <Statistic title={"Skipped"} value={processingStatus.skipped} />
            <Statistic title={"Pending"} value={processingStatus.pending} />
            <Statistic title={"Failed"} value={processingStatus.failed} />
            <Statistic title={"Total"} value={processingStatus.total} />
          </Space>
        </Space>
      </Col>
    );
  }

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
          <RefreshTimer
            ttlMs={60000}
            fetchFunction={async () => {
              await fetchWorkflows(true);
            }}
          />
          <Row
            gutter={16}
            style={{
              borderTop: "1px solid #f3f3f3",
              borderBottom: "1px solid #f3f3f3",
            }}
          >
            {actionsContent}
          </Row>
          <Table
            style={{ width: "100%" }}
            rowKey={(record) => {
              return `${record.id}`;
            }}
            columns={columns}
            sticky={true}
            scroll={{ y: `calc(100vh - ${197 + 64}px)` }}
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
            rowSelection={{
              selectedRowKeys,
              onChange: onSelectChange,
            }}
          />
        </ConfigProvider>
      </Content>
    </>
  );
};

export default IndexPage;
