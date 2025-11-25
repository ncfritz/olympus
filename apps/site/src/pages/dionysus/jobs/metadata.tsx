import {
  DeleteOutlined,
  HomeOutlined,
  LoginOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type {
  FilterDefinition,
  GetMetadataFetchJobStatusStatisticsResponse,
  ListMetadataFetchJobsResponse,
  MetadataFetchJob,
  MetadataFetchJobStatus,
} from "@ncfritz/olympus-sdk/dionysus";
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
import { Content } from "antd/lib/layout/layout";
import { DateTime } from "luxon";
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import Timestamp from "../../../components/data/Timestamp";
import CreateMetadataJobModal from "../../../components/dionysus/jobs/CreateMetadataJobModal";
import MetadataFetchJobExpirationChart from "../../../components/dionysus/jobs/graphs/MetadataFetchJobExpirationChart";
import MetadataFetchJobStatusChart from "../../../components/dionysus/jobs/graphs/MetadataFetchJobStatusChart";
import MetadataFetchJobDetailsPanel from "../../../components/dionysus/jobs/MetadataFetchJobDetailsPanel";
import MetadataJobStatusSelect from "../../../components/dionysus/jobs/MetadataJobStatusSelect";
import RedriveModal from "../../../components/dionysus/jobs/RedriveModal";
import { getMetadataJobStatusIndicator } from "../../../components/dionysus/jobs/utils";
import RefreshTimer from "../../../components/common/RefreshTimer";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";
import { buildFilterDefinitionForTable } from "../../../utils/filters";

type OnChange = NonNullable<TableProps<MetadataFetchJob>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const MetadataFetchJobsPage: React.FunctionComponent = () => {
  const [selectedJob, setSelectedJob] = useState<MetadataFetchJob | undefined>(
    undefined,
  );
  const [metadataFetchJobRequested, setMetadataFetchJobRequested] =
    useState("");
  const [metadataFetchJobsPage, setMetadataFetchJobsPage] = useState(0);
  const [metadataFetchJobsPageSize, setMetadataFetchJobsPageSize] =
    useState(50);
  const [metadataFetchJobsSort, setMetadataFetchJobsSort] =
    useState<SortOptions>({
      field: "type",
      order: "asc",
    });
  const [metadataFetchJobFilters, setMetadataFetchJobFilters] = useState<
    FilterDefinition | undefined
  >(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<MetadataFetchJob[]>([]);
  const [processingRows, setProcessingRows] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    pending: 0,
    skipped: 0,
    success: 0,
    failed: 0,
    total: 0,
  });
  const [targetStatus, setTargetStatus] =
    useState<MetadataFetchJobStatus>("queued");
  const [redriveModalOpen, setRedriveModalOpen] = useState(false);
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);

  const [jobStats, jobStatsLoading, jobStatsError, fetchStatistics] = useFetch<
    undefined,
    GetMetadataFetchJobStatusStatisticsResponse
  >({
    dataType: "batch job statistics",
    watch: [],
    params: undefined,
    fetchFunction: async () => (await metadataApi.fetchJobStatistics()).data,
  });

  const [
    metadataFetchJobs,
    metadataFetchJobsLoading,
    metadataFetchJobsError,
    fetchMetadataFetchJobs,
  ] = useFetch<undefined, ListMetadataFetchJobsResponse>({
    dataType: "metadata fetch jobs",
    watch: [metadataFetchJobFilters],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listMetadataFetchJobs(
          metadataFetchJobsPage,
          metadataFetchJobsPageSize,
          metadataFetchJobsSort,
          metadataFetchJobFilters,
        )
      ).data,
  });

  useEffect(() => {
    (async () => {
      await fetchMetadataFetchJobs(true);
      setSelectedRowKeys([]);
    })();
  }, [metadataFetchJobRequested]);

  const onSelectChange = (
    newSelectedRowKeys: React.Key[],
    newSelectedRows: MetadataFetchJob[],
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
        true,
      );
    });
  };

  const deleteSelectedJobs = async () => {
    await processRows(async (job) => {
      await metadataApi.deleteMetadataFetchJob(job.id, job.type);
    });
  };

  const processRows = async (
    process: (job: MetadataFetchJob) => Promise<void>,
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
          console.error(`Unable to process MetadataFetchJob ${value.id}`, e);
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
    statusChart = <MetadataFetchJobStatusChart stats={jobStats} />;
    expirationChart = <MetadataFetchJobExpirationChart stats={jobStats} />;
  }

  const columns: ColumnsType<MetadataFetchJob> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      render: (_value, record) => {
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
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 200,
      render: (_value, record) => {
        return <Typography.Text>{record.type}</Typography.Text>;
      },
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
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 200,
      render: (value) => {
        return getMetadataJobStatusIndicator(value);
      },
    },
    {
      key: "ttl",
      title: "TTL",
      dataIndex: "ttl",
      render: (value, record) => {
        return <Typography.Text>{record.ttl}d</Typography.Text>;
      },
      sorter: true,
      width: 100,
    },
    {
      key: "jitter",
      title: "Jitter",
      dataIndex: "jitter",
      render: (value, record) => {
        return <Typography.Text>{record.jitter}</Typography.Text>;
      },
      sorter: true,
      width: 100,
    },
    {
      key: "expiration",
      title: "Expiration",
      dataIndex: "expiration",
      render: (value, record) => {
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
      key: "lastFetchedTime",
      title: "Last Fetched",
      dataIndex: "lastFetchedTime",
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
          <MetadataJobStatusSelect
            value={targetStatus}
            onChange={(value) => {
              setTargetStatus(value);
            }}
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
            Delete Selected
          </Button>
        </Space>
      </Space>
      <Space style={{ marginRight: 16 }}>
        <Space
          direction={"horizontal"}
          size={8}
          style={{
            alignItems: "center",
            borderRight: "1px solid #f3f3f3",
            padding: 16,
          }}
        >
          <Button
            variant={"solid"}
            color={"pink"}
            icon={<LoginOutlined />}
            onClick={async () => {
              setRedriveModalOpen(true);
            }}
          >
            Create Re-drive
          </Button>
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
        </Space>
        <Button
          type={"text"}
          disabled={processingRows || metadataFetchJobsLoading}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchMetadataFetchJobs(true);
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
                <CertificationOutlined />
                <span>Metadata Jobs</span>
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
            sticky={true}
            scroll={{ y: "calc(100vh - 580px)" }}
            dataSource={metadataFetchJobs?.jobs}
            size={"small"}
            loading={metadataFetchJobsLoading || processingRows}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: metadataFetchJobsPageSize,
              size: "small",
              total: metadataFetchJobs?.count,
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
                  setMetadataFetchJobFilters(
                    buildFilterDefinitionForTable(filters),
                  );
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
          <RedriveModal
            open={redriveModalOpen}
            onClose={() => {
              setRedriveModalOpen(false);
            }}
            statistics={jobStats}
          />
          <CreateMetadataJobModal
            open={createJobModalOpen}
            onClose={() => {
              setCreateJobModalOpen(false);
            }}
          />
        </Content>
      </Layout>
    </div>
  );
};

export default MetadataFetchJobsPage;
