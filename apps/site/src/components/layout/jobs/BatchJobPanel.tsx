import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  Button,
  Col,
  Form,
  InputNumber,
  notification,
  Progress,
  Row,
  Space,
  Spin,
  Switch,
  Table,
  type TableProps,
  Tag,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import type { FilterValue } from "antd/es/table/interface";
import axios from "axios";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import batchJobApi from "../../../api/batchJobApi";
import type { SortOptions } from "../../../api/contentApi";
import Timestamp from "../../data/Timestamp";

export enum JobStatus {
  CREATED = "created",
  STARTED = "started",
  CANCELLED = "cancelled",
  SUCCESS = "success",
  FAILED = "failed",
}

export enum JobType {
  ALL = "all",
  MOVIES = "movies",
  TV_SERIES = "tv_series",
  PEOPLE = "people",
  COLLECTIONS = "collections",
  TV_NETWORKS = "tv_networks",
  KEYWORDS = "keywords",
  PRODUCTION_COMPANIES = "production_companies",
  CERTIFICATIONS = "certifications",
  COUNTRIES = "countries",
  GENRES = "genres",
  LANGUAGES = "languages",
}

export interface BatchJobRecord {
  id: string;
  createdTime: string;
  lastUpdatedTime?: string;
  startedTime?: string;
  finishedTime?: string;
  totalRecords?: number;
  duplicateRecords?: number;
  noOpRecords?: number;
  newRecords?: number;
  expiredRecords?: number;
  processedRecords?: number;
  skippedRecords?: number;
  status: JobStatus;
}

export interface BatchJobsPanelProps {
  type: JobType;
  onSelect: (value: BatchJobRecord) => void;
}

type OnChange = NonNullable<TableProps<BatchJobRecord>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const BatchJobPanel: React.FunctionComponent<BatchJobsPanelProps> = ({
  type,
  onSelect,
}) => {
  const [api, contextHolder] = notification.useNotification();

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
  const [targetStatus, setTargetStatus] = useState("queued");

  const [jobStats, setJobStats] = useState<any>();
  const [jobStatsLoading, setJobStatsLoading] = useState<any>(true);
  const [jobStatsError, setJobStatsError] = useState<any>();

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

  const fetchStatistics = async () => {
    setJobStatsLoading(true);
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
        switch (value) {
          case JobStatus.CREATED:
            return (
              <Tag
                color={"#003f5c"}
                icon={<ClockCircleOutlined />}
                style={{ minWidth: 120 }}
              >
                Created
              </Tag>
            );
          case JobStatus.STARTED:
            return (
              <Tag
                color={"#58508d"}
                icon={<SyncOutlined spin={true} />}
                style={{ minWidth: 120 }}
              >
                Running
              </Tag>
            );
          case JobStatus.CANCELLED:
            return (
              <Tag
                color={"#ffa600"}
                icon={<MinusCircleOutlined />}
                style={{ minWidth: 120 }}
              >
                Cancelled
              </Tag>
            );
          case JobStatus.SUCCESS:
            return (
              <Tag
                color={"#bc5090"}
                icon={<CheckCircleOutlined />}
                style={{ minWidth: 120 }}
              >
                Success
              </Tag>
            );
          case JobStatus.FAILED:
            return (
              <Tag
                color={"#ff6361"}
                icon={<CloseCircleOutlined />}
                style={{ minWidth: 120 }}
              >
                Failed
              </Tag>
            );
          default:
            return (
              <Tag icon={<QuestionCircleOutlined />} style={{ minWidth: 120 }}>
                Unknown
              </Tag>
            );
        }
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
    },
    {
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} />;
      },
      width: 150,
    },
    {
      title: "Started",
      dataIndex: "startedTime",
      render: (value) => {
        return <Timestamp value={value} />;
      },
      width: 150,
    },
    {
      title: "Finished",
      dataIndex: "finishedTime",
      render: (value) => {
        return <Timestamp value={value} />;
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
          plotOptions: {
            column: {
              stacking: "normal",
            },
            spline: {
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
              color: "#000000",
            },
            {
              name: "Removed",
              data: jobStats.series.records.removed,
              color: "#ff6361",
            },
            {
              name: "New",
              data: jobStats.series.records.new,
              color: "#bc5090",
            },
            {
              name: "Duplicates",
              data: jobStats.series.records.duplicate,
              color: "#003f5c",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );
  }

  return (
    <Space direction={"vertical"} style={{ width: "100%" }}>
      <Row gutter={8}>
        <Col span={12}>{timingChart}</Col>
        <Col span={12}>{recordsChart}</Col>
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
              <Form layout={"inline"}>
                <Form.Item label={"Skip Records"}>
                  <InputNumber min={0} defaultValue={0} />
                </Form.Item>
                <Form.Item label={"Publish Message"}>
                  <Switch />
                </Form.Item>
                <Button
                  type={"primary"}
                  icon={<SaveOutlined />}
                  onClick={async () => {
                    await batchJobApi.createBatchJob(type, true, 0);
                    await fetchJobs(true);
                  }}
                >
                  Submit
                </Button>
              </Form>
            </Space>
          </Space>
          <Space style={{ marginRight: 16 }}>
            <Button
              type={"text"}
              disabled={jobsLoading}
              icon={<ReloadOutlined />}
              onClick={async () => {
                await fetchJobs(true);
              }}
            />
          </Space>
        </Col>
      </Row>
      <Table
        rowKey={"id"}
        style={{ width: "100%" }}
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
    </Space>
  );
};
export default BatchJobPanel;
