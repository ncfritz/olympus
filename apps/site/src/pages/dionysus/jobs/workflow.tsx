import {
  HomeOutlined,
  KubernetesOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  Col,
  Drawer,
  Layout,
  notification,
  Row,
  Space,
  Spin,
  Table,
  type TableProps,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FilterValue } from "antd/es/table/interface";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { SortOptions } from "../../../api/contentApi";
import workflowApi from "../../../api/workflowApi";
import RefreshTimer from "../../../components/common/RefreshTimer";
import Timestamp from "../../../components/data/Timestamp";
import WorkflowQueueTimeChart from "../../../components/dionysus/jobs/graphs/WorkflowQueueTimeChart";
import WorkflowRuntimeChart from "../../../components/dionysus/jobs/graphs/WorkflowRuntimeChart";
import WorkflowStatusChart from "../../../components/dionysus/jobs/graphs/WorkflowStatusChart";
import {
  getMetadataJobStatusIndicator,
  getMetadataWorkflowStatusIndicator,
} from "../../../components/dionysus/jobs/utils";
import WorkflowDetailsPanel from "../../../components/dionysus/jobs/WorkflowDetailsPanel";
import { MetadataOutlinedIcon } from "../../../icons";
import { openNotificationWithIcon } from "../../../utils/notifications";

export type MetadataWorkflow = {
  id: string;
  createdTime: string;
  lastUpdatedTime: string;
  startedTime: string;
  finishedTime: string;
  status: string;
  stepCount: number;
};

type OnChange = NonNullable<TableProps<MetadataWorkflow>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataWorkflowsPage: React.FunctionComponent = () => {
  const [api] = notification.useNotification();

  const [metadataWorkflowStats, setMetadataWorkflowStats] = useState<any>();
  const [metadataWorkflowStatsLoading, setMetadataWorkflowStatsLoading] =
    useState<any>(true);
  const [, setJobStatsError] = useState<any>();
  const [metadataWorkflows, setMetadataWorkflows] = useState<any>();
  const [metadataWorkflowRequested, setMetadataWorkflowRequested] =
    useState("");
  const [metadataWorkflowsLoading, setMetadataWorkflowsLoading] =
    useState(true);
  const [, setMetadataWorkflowsError] = useState<any>();
  const [metadataWorkflowsCount, setMetadataWorkflowsCount] = useState(0);
  const [metadataWorkflowsPage, setMetadataWorkflowsPage] = useState(0);
  const [metadataWorkflowsPageSize, setMetadataWorkflowsPageSize] =
    useState(50);
  const [metadataWorkflowsSort, setMetadataWorkflowsSort] =
    useState<SortOptions>({
      field: "createdTime",
      order: "desc",
    });
  const [metadataWorkflowFilters, setMetadataWorkflowFilters] = useState<
    Record<string, FilterValue | null>
  >({});
  const [selectedWorkflow, setSelectedWorkflow] = useState<
    MetadataWorkflow | undefined
  >(undefined);

  const fetchWorkflowStatistics = async (quiet = false) => {
    if (!quiet) {
      setMetadataWorkflowStatsLoading(true);
    }
    setJobStatsError(undefined);

    try {
      const getWorkflowStatsResponse =
        await workflowApi.getWorkflowStatistics();
      setMetadataWorkflowStats(getWorkflowStatsResponse.data);
    } catch (e) {
      setJobStatsError(e);
    } finally {
      setMetadataWorkflowStatsLoading(false);
    }
  };

  const fetchMetadataWorkflows = async (quiet = false) => {
    if (!quiet) {
      setMetadataWorkflowsLoading(true);
    }
    setMetadataWorkflowsError(undefined);

    try {
      const listMetadataWorkflowsResponse =
        await workflowApi.listMetadataWorkflows(
          metadataWorkflowsPage,
          metadataWorkflowsPageSize,
          metadataWorkflowsSort,
          metadataWorkflowFilters,
        );
      setMetadataWorkflows(listMetadataWorkflowsResponse.data.workflows);
      setMetadataWorkflowsCount(listMetadataWorkflowsResponse.data.count);
    } catch (e) {
      setMetadataWorkflowsError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load certifications list",
        "Poop",
        api,
      );
    } finally {
      setMetadataWorkflowsLoading(false);
    }
  };

  const createWorkflow = async () => {
    await workflowApi.createWorkflow();
    await fetchMetadataWorkflows(true);
  };

  useEffect(() => {
    (async () => {
      await fetchMetadataWorkflows();
      await fetchWorkflowStatistics();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await fetchMetadataWorkflows();
    })();
  }, [metadataWorkflowRequested]);

  const closeDrawer = () => {
    setSelectedWorkflow(undefined);
  };

  let statusChart = (
    <Space style={{ height: 300, display: "flex", justifyContent: "center" }}>
      <Spin />
    </Space>
  );
  let queueTimingChart = (
    <Space style={{ height: 300, display: "flex", justifyContent: "center" }}>
      <Spin />
    </Space>
  );
  let runTimingChart = (
    <Space style={{ height: 300, display: "flex", justifyContent: "center" }}>
      <Spin />
    </Space>
  );

  if (!metadataWorkflowStatsLoading) {
    statusChart = <WorkflowStatusChart stats={metadataWorkflowStats} />;
    queueTimingChart = <WorkflowQueueTimeChart stats={metadataWorkflowStats} />;
    runTimingChart = <WorkflowRuntimeChart stats={metadataWorkflowStats} />;
  }

  const columns: ColumnsType<MetadataWorkflow> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (_value, record) => {
        return (
          <Typography.Link
            onClick={() => {
              setSelectedWorkflow(record);
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
          text: getMetadataWorkflowStatusIndicator("created"),
          value: "queued",
        },
        {
          text: getMetadataWorkflowStatusIndicator("started"),
          value: "started",
        },
        {
          text: getMetadataWorkflowStatusIndicator("success"),
          value: "success",
        },
        {
          text: getMetadataJobStatusIndicator("failed"),
          value: "failed",
        },
      ],
      render: (value) => {
        return getMetadataWorkflowStatusIndicator(value);
      },
      sorter: true,
      width: 200,
    },
    {
      key: "stepCount",
      title: "Step Count",
      dataIndex: "stepCount",
      render: (value) => {
        return (
          <Typography.Text style={{ fontFamily: "monospace" }}>
            {value}
          </Typography.Text>
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

  const actionsContent = (
    <Col span={24} style={{ justifyContent: "space-between", display: "flex" }}>
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
          <Typography.Text strong={true}>Create Workflow: </Typography.Text>
          <Button
            type={"primary"}
            icon={<PlusOutlined />}
            onClick={async () => {
              await createWorkflow();
            }}
          >
            Start New Workflow
          </Button>
        </Space>
      </Space>
      <Space style={{ marginRight: 16 }}>
        <Button
          type={"text"}
          disabled={metadataWorkflowsLoading}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchMetadataWorkflows();
          }}
        />
      </Space>
    </Col>
  );

  return (
    <div>
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
                <KubernetesOutlined />
                <span>Metadata Workflows</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>{statusChart}</Col>
            <Col span={8}>{queueTimingChart}</Col>
            <Col span={8}>{runTimingChart}</Col>
          </Row>
          <Row>
            <Col span={24}>
              <RefreshTimer
                ttlMs={60000}
                fetchFunction={async () => {
                  await fetchMetadataWorkflows(true);
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
            {actionsContent}
          </Row>
          <Table
            style={{ width: "100%" }}
            rowKey={(record) => {
              return `${record.id}`;
            }}
            columns={columns}
            dataSource={metadataWorkflows}
            size={"middle"}
            loading={metadataWorkflowsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: metadataWorkflowsPageSize,
              size: "small",
              total: metadataWorkflowsCount,
              showSizeChanger: true,
              pageSizeOptions: [25, 50, 100, 250, 500],
              onShowSizeChange: (current, size) => {
                setMetadataWorkflowsPageSize(size);
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
                  setMetadataWorkflowsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setMetadataWorkflowsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  break;
                case "filter":
                  setMetadataWorkflowsPage(0);
                  setMetadataWorkflowFilters(filters);
                  break;
              }

              setMetadataWorkflowRequested(new Date().toISOString());
            }}
          />
          <Drawer
            title="Workflow Details"
            width={750}
            placement="right"
            onClose={() => {
              closeDrawer();
            }}
            open={selectedWorkflow !== undefined}
          >
            <WorkflowDetailsPanel workflow={selectedWorkflow} />
          </Drawer>
        </Content>
      </Layout>
    </div>
  );
};

export default MetadataWorkflowsPage;
