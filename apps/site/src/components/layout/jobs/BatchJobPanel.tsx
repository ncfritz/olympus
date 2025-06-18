"use client";

import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Button,
  Col,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  type TableProps,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import type { FilterValue } from "antd/es/table/interface";
import axios from "axios";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useEffect, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import batchJobApi from "../../../api/batchJobApi";
import type { SortOptions } from "../../../api/contentApi";
import {
  type BatchJobRecord,
  JobStatus,
  type JobType,
} from "../../../types/dionysus";
import Timestamp from "../../data/Timestamp";
import BatchJobStatusSelect from "../../dionysus/jobs/BatchJobStatusSelect";
import CreateBatchJobModal from "../../dionysus/jobs/CreateBatchJobModal";
import { getBatchJobStatusIndicator } from "../../dionysus/jobs/utils";

interface FormInput {
  type: JobType;
  publishNotifications: boolean;
  offset: number;
}

export interface BatchJobsPanelProps {
  type: JobType;
  onSelect: (value: BatchJobRecord) => void;
  showPublish?: boolean;
  showStats?: boolean;
}

type OnChange = NonNullable<TableProps<BatchJobRecord>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const BatchJobPanel: React.FunctionComponent<BatchJobsPanelProps> = ({
  type,
  onSelect,
  showPublish = true,
  showStats = true,
}) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { isValid, isDirty, isSubmitting },
  } = useForm<FormInput>({
    defaultValues: {
      type: type,
      publishNotifications: true,
      offset: 0,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [jobs, setJobs] = useState<any>();
  const [jobsRequested, setJobsRequested] = useState("");
  const [jobsLoading, setJobsLoading] = useState<any>(true);
  const [jobsError, setJobsError] = useState<any>();
  const [jobsCount, setjJobsCount] = useState(0);
  const [jobsPage, setJobsPage] = useState(0);
  const [jobsPageSize, setJobsPageSize] = useState(50);
  const [jobsSort, setJobsSort] = useState<SortOptions>({
    field: "type",
    order: "asc",
  });
  const [jobFilters, setJobFilters] = useState<
    Record<string, FilterValue | null>
  >({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<BatchJobRecord[]>([]);
  const [processingRows, setProcessingRows] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    pending: 0,
    skipped: 0,
    success: 0,
    failed: 0,
    total: 0,
  });
  const [jobStats, setJobStats] = useState<any>();
  const [jobStatsLoading, setJobStatsLoading] = useState<any>(true);
  const [jobStatsError, setJobStatsError] = useState<any>();
  const [targetStatus, setTargetStatus] = useState(JobStatus.CREATED);
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    await batchJobApi.createBatchJob(
      type,
      data.publishNotifications,
      data.offset,
    );
    await fetchJobs(true);

    reset();
  };

  const fetchJobs = async (quiet = false) => {
    if (!quiet) {
      setJobsLoading(true);
    }
    setJobsError(undefined);

    try {
      const listJobsResponse = await axios.get(`/api/v1/jobs/batch/${type}`);
      setJobs(listJobsResponse.data.jobs);
    } catch (e) {
      setJobsError(e);
    } finally {
      setJobsLoading(false);
    }
  };

  const fetchStatistics = async (quiet = false) => {
    if (!quiet) {
      setJobStatsLoading(true);
    }
    setJobStatsError(undefined);

    try {
      const getJobsStatsResponse = await axios.get(
        `/api/v1/jobs/batch/${type}/stats`,
      );
      setJobStats(getJobsStatsResponse.data);
    } catch (e) {
      setJobStatsError(e);
    } finally {
      setJobStatsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchJobs();
      await fetchStatistics();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await fetchJobs();
      setSelectedRowKeys([]);
    })();
  }, [jobsRequested]);

  const onSelectChange = (
    newSelectedRowKeys: React.Key[],
    newSelectedRows: BatchJobRecord[],
  ) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const deleteSelectedJobs = async () => {
    await processRows(async (job) => {
      await batchJobApi.deleteBatchJob(job.id);
    });
  };

  const updateSelectedJobs = async () => {
    await processRows(async (job) => {
      const updates = {
        status: targetStatus,
      };

      await batchJobApi.updateBatchJob(job.id, updates);
    });

    setTargetStatus(JobStatus.CREATED);
  };

  const processRows = async (
    process: (job: BatchJobRecord) => Promise<void>,
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
          await process(value);

          currentStatus.success++;
        } catch (e) {
          currentStatus.failed++;
        }

        currentStatus.total++;
        setProcessingStatus({ ...currentStatus });
      }
    } finally {
      await fetchJobs(true);
      await fetchStatistics(true);
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

  const columns: ColumnsType<BatchJobRecord> = [
    {
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography.Link
              onClick={() => {
                onSelect(record);
              }}
            >
              {value}
            </Typography.Link>
          </Space>
        );
      },
      width: 350,
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value) => {
        return getBatchJobStatusIndicator(value);
      },
      filters: [
        {
          text: "Created",
          value: "created",
        },
        {
          text: "Started",
          value: "started",
        },
        {
          text: "Success",
          value: "Success",
        },
        {
          text: "Failed",
          value: "failed",
        },
        {
          text: "Cancelled",
          value: "cancelled",
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      onFilter: (value: string, record) => record.status === value,
      sorter: (a, b) => a.status.localeCompare(b.status),
      width: 200,
    },
    {
      key: "progress",
      title: "Progress",
      dataIndex: "totalRecords",
      render: (value, record) => {
        const percent =
          record.totalRecords && record.totalRecords > 0
            ? (record.processedRecords! / record.totalRecords) * 100
            : 0;

        let status: "normal" | "success" | "exception" = "normal";

        if (record.status === JobStatus.SUCCESS) {
          status = "success";
        } else if (
          record.status === JobStatus.CANCELLED ||
          record.status === JobStatus.FAILED
        ) {
          status = "exception";
        }

        let etaContent = <></>;

        if (record.status === JobStatus.STARTED) {
          const startTime = DateTime.fromISO(
            record.startedTime as unknown as string,
          );
          const now = DateTime.utc();
          const runningMs = now.diff(startTime).milliseconds;
          const timePerRecord = runningMs / record.processedRecords!;
          const remainingEst = Math.ceil(
            (record.totalRecords! - record.processedRecords!) * timePerRecord,
          );

          etaContent = (
            <Row style={{ margin: 0, padding: 0 }}>
              <Col span={12}>
                <Typography.Text style={{ fontSize: "12px" }}>
                  Runtime:
                </Typography.Text>
                <Typography.Text style={{ fontSize: "12px" }}>
                  {prettyMilliseconds(runningMs, { unitCount: 2 })}
                </Typography.Text>
              </Col>
              <Col span={12}>
                <Typography.Text style={{ fontSize: "12px" }}>
                  ETA:
                </Typography.Text>
                <Typography.Text style={{ fontSize: "12px" }}>
                  {isFinite(remainingEst)
                    ? prettyMilliseconds(remainingEst, { unitCount: 2 })
                    : "∞"}
                </Typography.Text>
              </Col>
            </Row>
          );
        }

        return (
          <Space size={0} direction={"vertical"} style={{ paddingRight: 32 }}>
            <Progress
              showInfo={true}
              size={"small"}
              style={{ margin: 0, width: 250, padding: 0 }}
              percent={Math.abs(percent)}
              format={(percent) => {
                return `${percent?.toFixed(2)}%`;
              }}
              status={status}
            />
            {etaContent}
          </Space>
        );
      },
      width: 300,
    },
    {
      title: "Total",
      dataIndex: "totalRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.totalRecords}
          </Typography.Text>
        );
      },
      width: 75,
    },
    {
      title: "Processed",
      dataIndex: "processedRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.processedRecords}
          </Typography.Text>
        );
      },
      width: 100,
    },
    {
      title: "Duplicate",
      dataIndex: "duplicateRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.duplicateRecords}
          </Typography.Text>
        );
      },
      width: 85,
    },
    {
      title: "New",
      dataIndex: "newRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.newRecords}
          </Typography.Text>
        );
      },
      width: 75,
    },
    {
      title: "Expired",
      dataIndex: "expiredRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.expiredRecords}
          </Typography.Text>
        );
      },
      width: 75,
    },
    {
      title: "No-Op",
      dataIndex: "noOpRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.noOpRecords}
          </Typography.Text>
        );
      },
      width: 75,
    },
    {
      title: "Skipped",
      dataIndex: "skippedRecords",
      render: (value, record) => {
        return (
          <Typography.Text style={{ fontSize: "12px" }}>
            {record.skippedRecords}
          </Typography.Text>
        );
      },
    },
    {
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      width: 150,
    },
    {
      title: "Started",
      dataIndex: "startedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      width: 150,
    },
    {
      title: "Finished",
      dataIndex: "finishedTime",
      render: (value) => {
        return <Timestamp value={value} showTime={true} />;
      },
      width: 150,
    },
  ];

  let timingChart = (
    <Space>
      <Spin />
    </Space>
  );

  let recordsChart = (
    <Space>
      <Spin />
    </Space>
  );

  if (!jobStatsLoading) {
    timingChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 250,
          },
          tooltip: {
            shared: true,
          },
          plotOptions: {
            spline: {
              marker: {
                symbol: "square",
                radius: 2,
              },
              lineWidth: 1,
            },
          },
          title: {
            text: "Timing",
            style: { fontSize: 10 },
          },
          xAxis: {
            type: "datetime",
            labels: {
              format: "{value:%m-%d}",
            },
            lineWidth: 0,
          },
          yAxis: {
            title: {
              text: "ms",
            },
          },
          legend: {
            align: "left",
          },
          series: [
            {
              type: "spline",
              name: "Runtime",
              data: jobStats.series.timing.runtime,
              color: "#000000",
            },
            {
              type: "spline",
              name: "Queue Time",
              data: jobStats.series.timing.queueTime,
              color: "#bc5090",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );

    recordsChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 250,
            type: "column",
          },
          tooltip: {
            shared: true,
          },
          plotOptions: {
            series: {
              stacking: "normal",
            },
            column: {
              pointWidth: 8,
            },
            spline: {
              stacking: undefined,
              marker: {
                symbol: "square",
                radius: 2,
              },
              lineWidth: 1,
            },
          },
          title: {
            text: "Record Processing Statistics",
            style: { fontSize: 10 },
          },
          legend: {
            align: "left",
            symbolRadius: 0,
          },
          xAxis: {
            type: "datetime",
            labels: {
              format: "{value:%m-%d}",
            },
            lineWidth: 0,
          },
          yAxis: {
            title: {
              text: "Count",
            },
          },
          series: [
            {
              name: "Total",
              type: "spline",
              data: jobStats.series.records.total,
              color: "#003f5c",
            },
            {
              name: "Processed",
              type: "spline",
              data: jobStats.series.records.processed,
              color: "#bc5090",
            },
            {
              name: "New",
              data: jobStats.series.records.new,
              color: "#003f5c",
            },
            {
              name: "Expired",
              data: jobStats.series.records.expired,
              color: "#7a5195",
            },
            {
              name: "No-op",
              data: jobStats.series.records.noop,
              color: "#ef5675",
            },
            {
              name: "Skipped",
              data: jobStats.series.records.skipped,
              color: "#ffa600",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );
  }

  const tools: ReactNode[] = [];

  tools.push(
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
      <BatchJobStatusSelect
        value={targetStatus}
        onChange={(value) => {
          setTargetStatus(value);
        }}
      />
      <Button
        type={"primary"}
        icon={<SaveOutlined />}
        disabled={selectedRows.length <= 0 || processingRows || jobsLoading}
        onClick={async () => {
          await updateSelectedJobs();
        }}
      >
        Set Status
      </Button>
    </Space>,
  );

  tools.push(
    <Space
      direction={"horizontal"}
      size={8}
      style={{
        alignItems: "center",
        borderRight: "1px solid #f3f3f3",
        padding: 16,
      }}
    >
      <Typography.Text strong={true}>Delete: </Typography.Text>
      <Button
        type={"primary"}
        icon={<DeleteOutlined />}
        danger={true}
        disabled={selectedRows.length <= 0 || processingRows || jobsLoading}
        onClick={async () => {
          await deleteSelectedJobs();
        }}
      >
        Delete Selected
      </Button>
    </Space>,
  );

  let actionsContent = (
    <Col span={24} style={{ justifyContent: "space-between", display: "flex" }}>
      <Space
        direction={"horizontal"}
        style={{
          padding: 0,
          marginLeft: showPublish ? 16 : 0,
          marginRight: 16,
        }}
      >
        {tools}
      </Space>
      <Space style={{ marginRight: 16 }}>
        {showPublish && (
          <Button
            variant={"solid"}
            color={"cyan"}
            icon={<PlusOutlined />}
            onClick={async () => {
              setCreateJobModalOpen(true);
            }}
          >
            Create Metadata Job
          </Button>
        )}
        <Button
          type={"text"}
          disabled={processingRows || jobsLoading}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchJobs(true);
            await fetchStatistics(true);
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
    <Space
      direction={"vertical"}
      style={{ width: "100%", marginTop: showStats ? 8 : 0 }}
      size={0}
    >
      {showStats && (
        <Row gutter={8}>
          <Col span={12}>{timingChart}</Col>
          <Col span={12}>{recordsChart}</Col>
        </Row>
      )}
      <Row
        gutter={16}
        style={{
          borderTop: showStats ? "1px solid #f3f3f3" : "none",
          borderBottom: "1px solid #f3f3f3",
        }}
      >
        {actionsContent}
      </Row>
      <Table
        rowKey={"id"}
        style={{
          width: "100%",
          borderTop: !showPublish ? "1px solid #f3f3f3" : "none",
        }}
        columns={columns}
        dataSource={jobs}
        size={"middle"}
        loading={jobsLoading}
        pagination={{
          style: {
            marginLeft: 16,
          },
          position: ["bottomLeft"],
          pageSize: jobsPageSize,
          size: "small",
          total: jobsCount,
          showSizeChanger: true,
          pageSizeOptions: [25, 50, 100, 250, 500],
          onShowSizeChange: (current, size) => {
            setJobsPageSize(size);
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
              setJobsPage(pagination.current! - 1);
              break;
            case "sort":
              setJobsSort({
                field: s.columnKey?.toString() || "",
                order: s.order === "ascend" ? "asc" : "desc",
              });
              break;
            case "filter":
              setJobsPage(0);
              setJobFilters(filters);
              break;
          }

          setJobsRequested(new Date().toISOString());
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: onSelectChange,
        }}
      />
      <CreateBatchJobModal
        type={type}
        postCreate={async () => {
          await fetchJobs();
          await fetchStatistics();
        }}
        open={createJobModalOpen}
        onClose={() => {
          setCreateJobModalOpen(false);
        }}
      />
    </Space>
  );
};
export default BatchJobPanel;
