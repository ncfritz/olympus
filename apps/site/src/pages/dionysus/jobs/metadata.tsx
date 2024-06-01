import {
  DeleteOutlined,
  HomeOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  Col,
  Drawer,
  notification,
  Progress,
  Row,
  Select,
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
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { DateTime } from "luxon";
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useEffect, useState } from "react";
import { type SortOptions } from "../../../api/contentApi";
import metadataApi from "../../../api/metadataApi";
import Timestamp from "../../../components/data/Timestamp";
import MetadataFetchJobDetailsPanel from "../../../components/dionysus/jobs/MetadataFetchJobDetailsPanel";
import { getMetadataJobStatusIndicator } from "../../../components/dionysus/jobs/utils";
import RefreshTimer from "../../../components/tools/layout/RefreshTimer";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";

export interface MetadataFetchjob {
  id: string;
  type: string;
  status: string;
  createdTime: string;
  lastUpdatedTime: string;
  lastFetchedTime: string;
  ttl: number;
  jitter: number;
}

type OnChange = NonNullable<TableProps<MetadataFetchjob>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type NotificationType = "success" | "info" | "warning" | "error";

const MetadataFetchJobsPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [selectedJob, setSelectedJob] = useState<MetadataFetchjob | undefined>(
    undefined,
  );
  const [jobStats, setJobStats] = useState<any>();
  const [jobStatsLoading, setJobStatsLoading] = useState<any>(true);
  const [jobStatsError, setJobStatsError] = useState<any>();

  const [metadataFetchJobs, setMetadataFetchJobs] = useState<any>();
  const [metadataFetchJobRequested, setMetadataFetchJobRequested] =
    useState("");
  const [metadataFetchJobsLoading, setMetadataFetchJobsLoading] =
    useState<any>(true);
  const [metadataFetchJobsError, setMetadataFetchJobsError] = useState<any>();
  const [metadataFetchJobsCount, setMetadataFetchJobsCount] = useState(0);
  const [metadataFetchJobsPage, setMetadataFetchJobsPage] = useState(0);
  const [metadataFetchJobsPageSize, setMetadataFetchJobsPageSize] =
    useState(50);
  const [metadataFetchJobsSort, setMetadataFetchJobsSort] =
    useState<SortOptions>({
      field: "type",
      order: "asc",
    });
  const [metadataFetchJobFilters, setMetadataFetchJobFilters] = useState<
    Record<string, FilterValue | null>
  >({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<MetadataFetchjob[]>([]);
  const [processingRows, setProcessingRows] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    pending: 0,
    skipped: 0,
    success: 0,
    failed: 0,
    total: 0,
  });
  const [targetStatus, setTargetStatus] = useState("queued");

  const openNotificationWithIcon = (
    type: NotificationType,
    message: string,
    content: ReactNode,
  ) => {
    api[type]({
      message: message,
      description: content,
    });
  };

  const fetchStatistics = async (quiet = false) => {
    if (!quiet) {
      setJobStatsLoading(true);
    }
    setJobStatsError(undefined);

    try {
      const getJobsStatsResponse = await metadataApi.fetchJobStatistics();
      setJobStats(getJobsStatsResponse.data);
    } catch (e) {
      setJobStatsError(e);
    } finally {
      setJobStatsLoading(false);
    }
  };

  const fetchMetadataFetchJobs = async (quiet = false) => {
    if (!quiet) {
      setMetadataFetchJobsLoading(true);
    }
    setMetadataFetchJobsError(undefined);

    try {
      const listMetadataFetchJobsResponse =
        await metadataApi.listMetadataFetchJobs(
          metadataFetchJobsPage,
          metadataFetchJobsPageSize,
          metadataFetchJobsSort,
          metadataFetchJobFilters,
        );
      setMetadataFetchJobs(listMetadataFetchJobsResponse.data.jobs);
      setMetadataFetchJobsCount(listMetadataFetchJobsResponse.data.count);
    } catch (e) {
      setMetadataFetchJobsError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load certifications list",
        "Poop",
      );
    } finally {
      setMetadataFetchJobsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchMetadataFetchJobs();
      await fetchStatistics();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await fetchMetadataFetchJobs();
      setSelectedRowKeys([]);
    })();
  }, [metadataFetchJobRequested]);

  const onSelectChange = (
    newSelectedRowKeys: React.Key[],
    newSelectedRows: MetadataFetchjob[],
  ) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const closeDrawer = () => {
    setSelectedJob(undefined);
  };

  const updateSelectedJobs = async (
    updateStatus: boolean,
    republish: boolean,
  ) => {
    await processRows(async (job) => {
      await metadataApi.updateMetadataFetchJob(
        job.id,
        job.type,
        {
          status: updateStatus ? targetStatus : job.status,
          lastFetchedTime: job.lastFetchedTime,
          ttl: job.ttl,
          jitter: job.jitter,
        },
        republish,
      );
    });
  };

  const deleteSelectedJobs = async () => {
    await processRows(async (job) => {
      await metadataApi.deleteMetadataFetchJob(job.id, job.type);
    });
  };

  const processRows = async (
    process: (job: MetadataFetchjob) => Promise<void>,
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
      await fetchMetadataFetchJobs(true);
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

  let statusChart = (
    <Space style={{ height: 300, display: "flex", justifyContent: "center" }}>
      <Spin />
    </Space>
  );

  let expirationChart = (
    <Space style={{ height: 300, display: "flex", justifyContent: "center" }}>
      <Spin />
    </Space>
  );

  if (!jobStatsLoading) {
    statusChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 300,
            type: "column",
          },
          tooltip: {
            shared: true,
          },
          plotOptions: {
            series: {
              stacking: "percent",
            },
            column: {
              pointWidth: 15,
            },
          },
          title: {
            text: "Job Statuses",
            style: { fontSize: 10 },
          },
          xAxis: {
            categories: [
              "Movies",
              "TV Series",
              "TV Seasons",
              "TV Episodes",
              "People",
              "Collections",
              "TV Networks",
              "Keywords",
              "Production Companies",
              "Certifications",
              "Genres",
              "Countries",
              "Languages",
            ],
          },
          legend: {
            layout: "vertical",
            align: "right",
            verticalAlign: "top",
          },
          series: [
            {
              name: "Queued",
              data: jobStats.status.series.queued,
              color: "#ffa600",
            },
            {
              name: "Invalidated",
              data: jobStats.status.series.invalidated,
              color: "#7a5195",
            },
            {
              name: "Fetching",
              data: jobStats.status.series.fetching,
              color: "#bc5090",
            },
            {
              name: "Cancelled",
              data: jobStats.status.series.cancelled,
              color: "#ff764a",
            },
            {
              name: "Fetched",
              data: jobStats.status.series.fetched,
              color: "#374c80",
            },
            {
              name: "Failed",
              data: jobStats.status.series.failed,
              color: "#ef5675",
            },
            {
              name: "Not Found",
              data: jobStats.status.series.not_found,
              color: "#003f5c",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );

    expirationChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 300,
            type: "column",
          },
          colors: [
            "#003f5c",
            "#19476f",
            "#374c80",
            "#58508d",
            "#7a5195",
            "#9c5196",
            "#bc5090",
            "#d85085",
            "#ef5675",
            "#ff6361",
            "#ff764a",
            "#ff8d2f",
            "#ffa600",
          ],
          tooltip: {
            shared: true,
          },
          plotOptions: {
            series: {
              stacking: "normal",
            },
            column: {
              colors: [
                "#003f5c",
                "#19476f",
                "#374c80",
                "#58508d",
                "#7a5195",
                "#9c5196",
                "#bc5090",
                "#d85085",
                "#ef5675",
                "#ff6361",
                "#ff764a",
                "#ff8d2f",
                "#ffa600",
              ],
            },
          },
          title: {
            text: "Expiration Distribution (Weeks)",
            style: { fontSize: 10 },
          },
          legend: {
            layout: "vertical",
            align: "right",
            verticalAlign: "top",
          },
          series: jobStats.expiration.series,
          credits: {
            enabled: false,
          },
        }}
      />
    );
  }

  const columns: ColumnsType<MetadataFetchjob> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (value, record, index) => {
        return (
          <Typography.Link
            onClick={() => {
              setSelectedJob(record);
            }}
          >
            {record.id}
          </Typography.Link>
        );
      },
      sorter: true,
      width: 150,
    },
    {
      key: "type",
      title: "Type",
      dataIndex: "type",
      filters: [
        {
          text: "Movies",
          value: "movies",
        },
        {
          text: "TV Series",
          value: "tv_series",
        },
        {
          text: "TV Seasons",
          value: "tv_seasons",
        },
        {
          text: "TV Episodes",
          value: "tv_episodes",
        },
        {
          text: "People",
          value: "people",
        },
        {
          text: "Collections",
          value: "collections",
        },
        {
          text: "TV Networks",
          value: "tv_networks",
        },
        {
          text: "Keywords",
          value: "keywords",
        },
        {
          text: "Production Companies",
          value: "production_companies",
        },
        {
          text: "Certifications",
          value: "certifications",
        },
        {
          text: "Genres",
          value: "genres",
        },
        {
          text: "Countries",
          value: "countries",
        },
        {
          text: "Languages",
          value: "languages",
        },
      ],
      render: (value, record, index) => {
        return <Typography.Text>{record.type}</Typography.Text>;
      },
      sorter: true,
      width: 175,
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
      filters: [
        {
          text: getMetadataJobStatusIndicator("queued"),
          value: "queued",
        },
        {
          text: getMetadataJobStatusIndicator("invalidated"),
          value: "invalidated",
        },
        {
          text: getMetadataJobStatusIndicator("fetching"),
          value: "fetching",
        },
        {
          text: getMetadataJobStatusIndicator("cancelled"),
          value: "cancelled",
        },
        {
          text: getMetadataJobStatusIndicator("fetched"),
          value: "fetched",
        },
        {
          text: getMetadataJobStatusIndicator("failed"),
          value: "failed",
        },
      ],
      render: (value, record, index) => {
        return getMetadataJobStatusIndicator(value);
      },
      sorter: true,
      width: 200,
    },
    {
      key: "ttl",
      title: "TTL",
      dataIndex: "ttl",
      render: (value, record, index) => {
        return <Typography.Text>{record.ttl}</Typography.Text>;
      },
      sorter: true,
      width: 100,
    },
    {
      key: "jitter",
      title: "Jitter",
      dataIndex: "jitter",
      render: (value, record, index) => {
        return <Typography.Text>{record.jitter}</Typography.Text>;
      },
      sorter: true,
      width: 100,
    },
    {
      key: "expiration",
      title: "Expiration",
      dataIndex: "expiration",
      render: (value, record, index) => {
        if (record.lastFetchedTime) {
          const now = DateTime.utc();
          const lastFetched = DateTime.fromISO(record.lastFetchedTime);
          const expiration = lastFetched.plus({
            day: record.ttl,
            minute: record.jitter,
          });

          const remaining = expiration.diff(now);
          const ttlMs =
            record.ttl * 24 * 60 * 60 * 1000 + record.jitter * 60 * 1000;
          const percent = (remaining.milliseconds / ttlMs) * 100;

          return (
            <Space
              direction={"horizontal"}
              size={16}
              style={{ paddingRight: 32 }}
            >
              <Progress
                showInfo={false}
                size={"small"}
                style={{ margin: "none", width: 200 }}
                percent={percent <= 0 ? 100 : Math.abs(percent)}
                status={percent <= 0 ? "exception" : "normal"}
              />
              <Typography.Text italic={remaining.milliseconds < 0}>
                {remaining.milliseconds < 0
                  ? "Expired"
                  : prettyMilliseconds(remaining.milliseconds, {
                      unitCount: 2,
                    })}
              </Typography.Text>
            </Space>
          );
        } else {
          return (
            <Typography.Text italic={true}>Not yet fetched</Typography.Text>
          );
        }
      },
      sorter: false,
    },
    {
      key: "createdTime",
      title: "Created",
      dataIndex: "createdTime",
      render: (value, record, index) => {
        return <Timestamp value={value} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "lastUpdatedTime",
      title: "Last Updated",
      dataIndex: "lastUpdatedTime",
      render: (value, record, index) => {
        return <Timestamp value={value} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "lastFetchedTime",
      title: "Last Fetched",
      dataIndex: "lastFetchedTime",
      render: (value, record, index) => {
        return <Timestamp value={value} />;
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
          <Typography.Text strong={true}>Republish: </Typography.Text>
          <Button
            type={"primary"}
            disabled={selectedRowKeys.length <= 0}
            icon={<ReloadOutlined />}
            onClick={async () => {
              await updateSelectedJobs(false, true);
            }}
          >
            Republish
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
          <Typography.Text strong={true}>Status: </Typography.Text>
          <Select
            value={targetStatus}
            onChange={(value) => {
              setTargetStatus(value);
            }}
            style={{ width: 200 }}
            bordered={false}
            options={[
              {
                value: "queued",
                label: getMetadataJobStatusIndicator("queued", true),
              },
              {
                value: "invalidated",
                label: getMetadataJobStatusIndicator("invalidated", true),
              },
              {
                value: "fetching",
                label: getMetadataJobStatusIndicator("fetching", true),
              },
              {
                value: "cancelled",
                label: getMetadataJobStatusIndicator("cancelled", true),
              },
              {
                value: "fetched",
                label: getMetadataJobStatusIndicator("fetched", true),
              },
              {
                value: "failed",
                label: getMetadataJobStatusIndicator("failed", true),
              },
            ]}
          />
          <Button
            type={"primary"}
            disabled={selectedRowKeys.length <= 0}
            icon={<SaveOutlined />}
            onClick={async () => {
              await updateSelectedJobs(true, false);
            }}
          >
            Set Status
          </Button>
          <Button
            type={"primary"}
            disabled={selectedRowKeys.length <= 0}
            icon={<SendOutlined />}
            onClick={async () => {
              await updateSelectedJobs(true, true);
            }}
          >
            Set Status & Republish
          </Button>
        </Space>
        <Space direction={"horizontal"} size={8}>
          <Typography.Text strong={true}>Delete:</Typography.Text>
          <Button
            type={"primary"}
            danger={true}
            disabled={selectedRowKeys.length <= 0}
            icon={<DeleteOutlined />}
            onClick={async () => {
              await deleteSelectedJobs();
            }}
          >
            Delete
          </Button>
        </Space>
      </Space>
      <Space style={{ marginRight: 16 }}>
        <Button
          type={"text"}
          disabled={processingRows || metadataFetchJobsLoading}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchMetadataFetchJobs();
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
            format={(percent, successPercent) => {
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
    <>
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
                <CertificationOutlined />
                <span>Metadata Jobs</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          background: "#fff",
          marginTop: 16,
        }}
      >
        <Content
          style={{
            marginBottom: 16,
          }}
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={16}>{expirationChart}</Col>
            <Col span={8}>{statusChart}</Col>
          </Row>
          <Row>
            <Col span={24}>
              <RefreshTimer
                ttlMs={60000}
                fetchFunction={async () => {
                  await fetchStatistics(true);
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
              return `${record.id}-${record.type}`;
            }}
            columns={columns}
            dataSource={metadataFetchJobs}
            size={"middle"}
            loading={metadataFetchJobsLoading || processingRows}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: metadataFetchJobsPageSize,
              size: "small",
              total: metadataFetchJobsCount,
              showSizeChanger: true,
              pageSizeOptions: [25, 50, 100, 250, 500],
              onShowSizeChange: (current, size) => {
                setMetadataFetchJobsPageSize(size);
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
                  setMetadataFetchJobsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setMetadataFetchJobsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  break;
                case "filter":
                  setMetadataFetchJobsPage(0);
                  setMetadataFetchJobFilters(filters);
                  break;
              }

              setMetadataFetchJobRequested(new Date().toISOString());
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: onSelectChange,
            }}
          />
          <Drawer
            title="Fetch Job Details"
            width={550}
            placement="right"
            onClose={() => {
              closeDrawer();
            }}
            open={selectedJob !== undefined}
          >
            <MetadataFetchJobDetailsPanel
              job={selectedJob!}
              close={closeDrawer}
              postUpdate={async () => {
                await fetchMetadataFetchJobs(true);
              }}
            />
          </Drawer>
        </Content>
      </Content>
    </>
  );
};

export default MetadataFetchJobsPage;
