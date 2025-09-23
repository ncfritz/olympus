import {
  HomeOutlined,
  KubernetesOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  Col,
  Drawer,
  Layout,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  type TableProps,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FilterValue } from "antd/es/table/interface";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import type { SortOptions } from "../../../api/common";
import workflowApi from "../../../api/workflowApi";
import RefreshTimer from "../../../components/common/RefreshTimer";
import { MonoNumber } from "../../../components/common/styledComponents";
import Timestamp from "../../../components/data/Timestamp";
import WorkflowStatusSelect from "../../../components/dionysus/jobs/WorkflowStatusSelect";
import WorkflowQueueTimeChart from "../../../components/dionysus/jobs/graphs/WorkflowQueueTimeChart";
import WorkflowRuntimeChart from "../../../components/dionysus/jobs/graphs/WorkflowRuntimeChart";
import WorkflowStatusChart from "../../../components/dionysus/jobs/graphs/WorkflowStatusChart";
import {
  getMetadataJobStatusIndicator,
  getMetadataWorkflowStatusIndicator,
} from "../../../components/dionysus/jobs/utils";
import WorkflowDetailsPanel from "../../../components/dionysus/jobs/WorkflowDetailsPanel";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";
import {
  type GetMetadataWorkflowStatisticsResponse,
  type ListWorkflowsResponse,
  type PartialWorkflow,
  type WorkflowStatus,
  type Workflow,
} from "@ncfritz/olympus-sdk/dionysus";

type OnChange = NonNullable<TableProps<Workflow>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataWorkflowsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [metadataWorkflowRequested, setMetadataWorkflowRequested] =
    useState("");
  const [workflowsPage, setWorkflowsPage] = useState(0);
  const [workflowsPageSize, setWorkflowsPageSize] = useState(50);
  const [workflowsSort, setWorkflowsSort] = useState<SortOptions>({
    field: "createdTime",
    order: "desc",
  });
  const [workflowFilters, setWorkflowFilters] = useState<
    Record<string, FilterValue | null>
  >({});
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<
    string | undefined
  >(id as string);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<Workflow[]>([]);
  const [processingRows, setProcessingRows] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    pending: 0,
    skipped: 0,
    success: 0,
    failed: 0,
    total: 0,
  });
  const [targetStatus, setTargetStatus] = useState<WorkflowStatus>("created");

  const [
    workflowStatistics,
    workflowStatisticsLoading,
    workflowStatisticsError,
    fetchWorkflowStatistics,
  ] = useFetch<undefined, GetMetadataWorkflowStatisticsResponse>({
    dataType: "workflow statistics",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await workflowApi.getMetadataWorkflowStatistics()).data,
  });

  const [workflows, workflowsLoading, workflowsError, fetchWorkflows] =
    useFetch<undefined, ListWorkflowsResponse>({
      dataType: "workflows",
      watch: [],
      params: undefined,
      fetchFunction: async () =>
        (
          await workflowApi.listMetadataWorkflows(
            workflowsPage,
            workflowsPageSize,
            workflowsSort,
            workflowFilters,
          )
        ).data,
    });

  const createWorkflow = async () => {
    await workflowApi.createMetadataWorkflow();
    await fetchWorkflows(true);
  };

  useEffect(() => {
    (async () => {
      await fetchWorkflows(true);
      await fetchWorkflowStatistics(true);
    })();
  }, [metadataWorkflowRequested]);

  const closeDrawer = async () => {
    setSelectedWorkflowId(undefined);
    await router.push("/dionysus/jobs/workflow", "/dionysus/jobs/workflow", {
      shallow: true,
    });
  };

  const onSelectChange = (
    newSelectedRowKeys: React.Key[],
    newSelectedRows: Workflow[],
  ) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const updateSelectedWorkflows = async () => {
    await processRows(async (job) => {
      const updates: PartialWorkflow = {
        status: targetStatus,
      };

      await workflowApi.updateWorkflow(job.id, updates);
    });

    setTargetStatus("created");
  };

  const processRows = async (process: (job: Workflow) => Promise<void>) => {
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
          await process(value);

          currentStatus.success++;
        } catch (e) {
          currentStatus.failed++;
        }

        currentStatus.total++;
        setProcessingStatus({ ...currentStatus });
      }
    } finally {
      await fetchWorkflows(true);
      await fetchWorkflowStatistics(true);
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

  if (!workflowStatisticsLoading && workflowStatistics) {
    statusChart = <WorkflowStatusChart stats={workflowStatistics} />;
    queueTimingChart = <WorkflowQueueTimeChart stats={workflowStatistics} />;
    runTimingChart = <WorkflowRuntimeChart stats={workflowStatistics} />;
  }

  const columns: ColumnsType<Workflow> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (_value, record) => {
        return (
          <Typography.Link
            onClick={async () => {
              setSelectedWorkflowId(record.id);
              await router.push(
                `/dionysus/jobs/workflow?id=${record.id}`,
                `/dionysus/jobs/workflow?id=${record.id}`,
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
        {
          text: getMetadataJobStatusIndicator("cancelled"),
          value: "cancelled",
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
        return <MonoNumber value={value} />;
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

  let actionsContent = (
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
          <Typography.Text strong={true}>Status: </Typography.Text>
          <WorkflowStatusSelect
            value={targetStatus}
            onChange={(value) => {
              setTargetStatus(value);
            }}
          />
          <Button
            type={"primary"}
            icon={<SaveOutlined />}
            disabled={
              selectedRows.length <= 0 || processingRows || workflowsLoading
            }
            onClick={async () => {
              await updateSelectedWorkflows();
            }}
          >
            Set Status
          </Button>
        </Space>
        ,
      </Space>
      <Space style={{ marginRight: 16 }}>
        <Button
          type={"primary"}
          icon={<PlusOutlined />}
          onClick={async () => {
            await createWorkflow();
          }}
        >
          Start New Workflow
        </Button>
        <Button
          type={"text"}
          disabled={workflowsLoading}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchWorkflowStatistics(true);
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
          direction={"vertical"}
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
          <Space direction={"horizontal"} size={64}>
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
                  await fetchWorkflows(true);
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
            dataSource={workflows?.workflows}
            size={"middle"}
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
                  setWorkflowFilters(filters);
                  break;
              }

              setMetadataWorkflowRequested(new Date().toISOString());
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: onSelectChange,
            }}
          />
          <Drawer
            title="Workflow Details"
            width={750}
            placement="right"
            onClose={async () => {
              await closeDrawer();
            }}
            open={selectedWorkflowId !== undefined}
          >
            <WorkflowDetailsPanel workflowId={selectedWorkflowId} />
          </Drawer>
        </Content>
      </Layout>
    </div>
  );
};

export default MetadataWorkflowsPage;
