import {
  CloudServerOutlined,
  ExperimentOutlined,
  HomeOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentIngestionWorkflow,
  GetContentIngestionWorkflowStatisticsResponse,
  ListContentIngestionWorkflowsResponse,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  Col,
  ConfigProvider,
  Drawer,
  Empty,
  Popover,
  Row,
  Space,
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
import contentApi from "../../../api/contentApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import LoadingWrapper from "../../../components/common/LoadingWrapper";
import RefreshTimer from "../../../components/common/RefreshTimer";
import { MonoNumber } from "../../../components/common/styledComponents";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import ContentIngestionUploadModal from "../../../components/content/ContentIngestionUploadModal";
import ContentIngestionUrlUploadModal from "../../../components/content/ContentIngestionUrlUploadModal";
import ContentIngestionWorkflowDetailsPanel from "../../../components/content/ContentIngestWorkflowDetailsPanel";
import WorkflowSourceAggregateChart from "../../../components/content/graphs/WorkflowSourceAggregateChart";
import WorkflowStatusAggregateChart from "../../../components/content/graphs/WorkflowStatusAggregateChart";
import WorkflowStatusChart from "../../../components/content/graphs/WorkflowStatusChart";
import { getContentIngestionWorkflowStatusIndicator } from "../../../components/content/util";
import Timestamp from "../../../components/data/Timestamp";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<ContentIngestionWorkflow>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const AssetIngestPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [workflowsPage, setWorkflowsPage] = useState(0);
  const [workflowsPageSize, setWorkflowsPageSize] = useState(50);
  const [workflowsSort, setWorkflowsSort] = useState<SortOptions>({
    field: "createdTime",
    order: "desc",
  });
  const [workflowFilters, setWorkflowFilters] = useState<
    FilterDefinition | undefined
  >(undefined);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<
    string | undefined
  >(id as string);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadUrlsModalOpen, setUploadUrlsModalOpen] = useState(false);

  const [
    workflowStatistics,
    workflowStatisticsLoading,
    workflowStatisticsError,
    fetchWorkflowStatistics,
  ] = useFetch<undefined, GetContentIngestionWorkflowStatisticsResponse>({
    dataType: "workflow statistics",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await contentApi.getContentIngestionWorkflowStatistics()).data,
  });

  const [workflows, workflowsLoading, workflowsError, fetchWorkflows] =
    useFetch<undefined, ListContentIngestionWorkflowsResponse>({
      dataType: "workflows",
      watch: [workflowsPage, workflowsPageSize, workflowsSort, workflowFilters],
      params: undefined,
      fetchFunction: async () =>
        (
          await contentApi.listContentIngestionWorkflows(
            workflowsPage,
            workflowsPageSize,
            workflowsSort,
            workflowFilters,
          )
        ).data,
    });

  const closeDrawer = async () => {
    setSelectedWorkflowId(undefined);
    await router.push("/dionysus/content/ingest", "/dionysus/content/ingest", {
      shallow: true,
    });
  };

  const columns: ColumnsType<ContentIngestionWorkflow> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Typography.Link
            onClick={async () => {
              setSelectedWorkflowId(record.id);
              await router.push(
                `/dionysus/content/ingest?id=${record.id}`,
                `/dionysus/content/ingest?id=${record.id}`,
                {
                  shallow: true,
                },
              );
            }}
          >
            {record.id}
          </Typography.Link>
        );
      },
      sorter: true,
      width: 350,
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
      filters: [
        {
          text: getContentIngestionWorkflowStatusIndicator("queued"),
          value: "queued",
        },
        {
          text: getContentIngestionWorkflowStatusIndicator("running"),
          value: "running",
        },
        {
          text: getContentIngestionWorkflowStatusIndicator("duplicate"),
          value: "duplicate",
        },
        {
          text: getContentIngestionWorkflowStatusIndicator("success"),
          value: "success",
        },
        {
          text: getContentIngestionWorkflowStatusIndicator("failed"),
          value: "failed",
        },
        {
          text: getContentIngestionWorkflowStatusIndicator("skipped"),
          value: "skipped",
        },
      ],
      render: (value) => {
        return getContentIngestionWorkflowStatusIndicator(value);
      },
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 200,
    },
    {
      key: "stepCount",
      title: "Step Count",
      dataIndex: "stepCount",
      render: (value) => {
        return <MonoNumber value={value} />;
      },
      sorter: false,
      width: 100,
    },
    {
      key: "sourceType",
      title: "Source",
      dataIndex: "sourceType",
      render: (value, record) => {
        const content =
          value === "local" ? (
            <Space orientation={"horizontal"} size={8}>
              <SaveOutlined />
              Local
            </Space>
          ) : (
            <Space orientation={"horizontal"} size={8}>
              <CloudServerOutlined />
              Remote
            </Space>
          );

        return (
          <Popover
            placement={"bottomLeft"}
            content={
              <Typography.Text style={{ fontFamily: "monospace" }}>
                {record.source}
              </Typography.Text>
            }
          >
            {content}
          </Popover>
        );
      },
      sorter: false,
    },
    {
      key: "createdTime",
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "lastUpdatedTime",
      title: "Last Updated",
      dataIndex: "lastUpdatedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "startedTime",
      title: "Started",
      dataIndex: "startedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "finishedTime",
      title: "Finished",
      dataIndex: "finishedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      sorter: true,
      width: 200,
    },
  ];

  const statusAggregateChart = (
    <LoadingWrapper
      loading={workflowStatisticsLoading}
      error={workflowStatisticsError}
    >
      <WorkflowStatusAggregateChart stats={workflowStatistics} />
    </LoadingWrapper>
  );

  const sourceAggregateChart = (
    <LoadingWrapper
      loading={workflowStatisticsLoading}
      error={workflowStatisticsError}
    >
      <WorkflowSourceAggregateChart stats={workflowStatistics} />
    </LoadingWrapper>
  );

  const statusChart = (
    <LoadingWrapper
      loading={workflowStatisticsLoading}
      error={workflowStatisticsError}
    >
      <WorkflowStatusChart stats={workflowStatistics} />
    </LoadingWrapper>
  );

  return (
    <ContentAuthWrapper>
      <OlympusBreadcrumbs
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space orientation={"horizontal"} size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content"}>
                <Space orientation={"horizontal"} size={4}>
                  <ExperimentOutlined />
                  <span>Content</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content/assets"}>
                <Space orientation={"horizontal"} size={4}>
                  <VideoCameraOutlined />
                  <span>Assets</span>
                </Space>
              </Link>
            ),
          },
          {
            title: <Typography.Text>Asset Upload</Typography.Text>,
          },
        ]}
      />
      <Content
        style={{
          marginTop: 2,
          position: "fixed",
          zIndex: 10,
          height: "calc(100vh - 92px)",
        }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>{statusAggregateChart}</Col>
          <Col span={2}>{sourceAggregateChart}</Col>
          <Col span={14}>{statusChart}</Col>
        </Row>
        <Row>
          <Col span={24}>
            <RefreshTimer
              ttlMs={60000}
              fetchFunction={async () => {
                await fetchWorkflows(true);
                await fetchWorkflowStatistics(true);
              }}
            />
          </Col>
        </Row>
        <Row
          gutter={16}
          style={{
            borderTop: "1px solid #f3f3f3",
            borderBottom: "1px solid #f3f3f3",
          }}
        >
          <Col
            span={24}
            style={{ justifyContent: "space-between", display: "flex" }}
          >
            <Space
              direction={"horizontal"}
              style={{ padding: 0, marginLeft: 16, marginRight: 16 }}
            >
              <Space
                direction={"horizontal"}
                size={8}
                style={{
                  alignItems: "center",
                  borderRight: "1px solid #f3f3f3",
                  padding: 16,
                }}
              >
                <Typography.Text strong={true}>Upload: </Typography.Text>
                <Button
                  type={"primary"}
                  icon={<UploadOutlined />}
                  onClick={async () => {
                    setUploadModalOpen(true);
                  }}
                >
                  Upload Assets
                </Button>
              </Space>
              <Space
                direction={"horizontal"}
                size={8}
                style={{
                  alignItems: "center",
                  borderRight: "1px solid #f3f3f3",
                  padding: 16,
                }}
              >
                <Typography.Text strong={true}>
                  External Sources:
                </Typography.Text>
                <Button
                  type={"primary"}
                  icon={<UploadOutlined />}
                  onClick={async () => {
                    setUploadUrlsModalOpen(true);
                  }}
                >
                  Upload URLs
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
                  await fetchWorkflowStatistics(true);
                }}
              />
            </Space>
          </Col>
        </Row>
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
            rowKey={(record) => {
              return `${record.id}`;
            }}
            columns={columns}
            sticky={true}
            scroll={{ y: "calc(100vh - 444px)" }}
            dataSource={workflows?.workflows}
            size={"small"}
            loading={workflowsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: workflowsPageSize,
              size: "small",
              total: workflows?.count,
              showSizeChanger: true,
              pageSizeOptions: [25, 50, 100, 250, 500],
              onShowSizeChange: (current, size) => {
                setWorkflowsPageSize(size);
              },
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
                  break;
                case "filter":
                  setWorkflowsPage(0);
                  setWorkflowFilters(buildFilterDefinitionForTable(filters));
                  break;
              }
            }}
          />
        </ConfigProvider>
        <Drawer
          title="Workflow Details"
          width={750}
          placement="right"
          onClose={async () => {
            await closeDrawer();
          }}
          open={selectedWorkflowId !== undefined}
        >
          <ContentIngestionWorkflowDetailsPanel
            workflowId={selectedWorkflowId}
          />
        </Drawer>
      </Content>
      <ContentIngestionUploadModal
        isOpen={uploadModalOpen}
        close={() => {
          setUploadModalOpen(false);
        }}
        onUploadsComplete={async () => {
          await fetchWorkflows(true);
          await fetchWorkflowStatistics(true);
        }}
      />
      <ContentIngestionUrlUploadModal
        isOpen={uploadUrlsModalOpen}
        close={() => {
          setUploadUrlsModalOpen(false);
        }}
        onUploadsComplete={async () => {
          await fetchWorkflows(true);
          await fetchWorkflowStatistics(true);
        }}
      />
    </ContentAuthWrapper>
  );
};

export default AssetIngestPage;
