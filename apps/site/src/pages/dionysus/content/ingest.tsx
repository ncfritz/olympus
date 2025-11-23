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
  ListContentIngestionWorkflowsResponse,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
  Button,
  Col,
  ConfigProvider,
  Drawer, Empty,
  Popover,
  Row,
  Space,
  Table,
  type TableProps,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FilterValue } from "antd/es/table/interface";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import type { SortOptions } from "../../../api/common";
import contentApi from "../../../api/contentApi";
import ErrorBlock from "../../../components/common/ErrorBlock";
import { MonoNumber } from "../../../components/common/styledComponents";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import ContentIngestionUploadModal from "../../../components/content/ContentIngestionUploadModal";
import ContentIngestionUrlUploadModal from "../../../components/content/ContentIngestionUrlUploadModal";
import ContentIngestionWorkflowDetailsPanel from "../../../components/content/ContentIngestWorkflowDetailsPanel";
import { getContentIngestionWorkflowStatusIndicator } from "../../../components/content/util";
import Timestamp from "../../../components/data/Timestamp";
import { useFetch } from "../../../hooks/useFetch";

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
    Record<string, FilterValue | null>
  >({});
  const [workflowListUpdateRequested, setWorkflowListUpdateRequested] =
    useState("");

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<
    string | undefined
  >(id as string);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadUrlsModalOpen, setUploadUrlsModalOpen] = useState(false);

  const [workflows, workflowsLoading, workflowsError, fetchWorkflows] =
    useFetch<undefined, ListContentIngestionWorkflowsResponse>({
      dataType: "workflows",
      watch: [],
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

  useEffect(() => {
    (async () => {
      await fetchWorkflows(true);
    })();
  }, [workflowListUpdateRequested]);

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
          text: getContentIngestionWorkflowStatusIndicator("success"),
          value: "success",
        },
        {
          text: getContentIngestionWorkflowStatusIndicator("duplicate"),
          value: "duplicate",
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
            <Space direction={"horizontal"} size={8}>
              <SaveOutlined />
              Local
            </Space>
          ) : (
            <Space direction={"horizontal"} size={8}>
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

  return (
    <ContentAuthWrapper>
      <Content>
        <Content
          style={{
            position: "fixed",
            display: "block",
            top: 64,
            zIndex: 100,
            width: "calc(100vw - 380px)",
          }}
        >
          <Breadcrumb
            style={{
              padding: 8,
              paddingLeft: 16,
              background: "#f6f6f6",
            }}
            items={[
              {
                title: (
                  <Link href={"/"}>
                    <Space direction={"horizontal"} size={4}>
                      <HomeOutlined />
                      <span>Home</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link href={"/dionysus/content"}>
                    <Space direction={"horizontal"} size={4}>
                      <ExperimentOutlined />
                      <span>Content</span>
                    </Space>
                  </Link>
                ),
              },
              {
                title: (
                  <Link href={"/dionysus/content/assets"}>
                    <Space direction={"horizontal"} size={4}>
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
        </Content>
        <Content
          style={{
            background: "#fff",
          }}
        >
          <Content
            style={{
              marginTop: 38,
              position: "fixed",
              zIndex: 10,
              borderTop: "1px solid #efefef",
              width: "calc(100vw - 380px)",
            }}
          >
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

                  setWorkflowListUpdateRequested(new Date().toISOString());
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
        </Content>
      </Content>
      <ContentIngestionUploadModal
        isOpen={uploadModalOpen}
        close={() => {
          setUploadModalOpen(false);
        }}
        onUploadsComplete={async () => {
          await fetchWorkflows(true);
        }}
      />
      <ContentIngestionUrlUploadModal
        isOpen={uploadUrlsModalOpen}
        close={() => {
          setUploadUrlsModalOpen(false);
        }}
        onUploadsComplete={async () => {
          await fetchWorkflows(true);
        }}
      />
    </ContentAuthWrapper>
  );
};

export default AssetIngestPage;
