import "plyr-react/plyr.css";
import {
  ExperimentOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Breadcrumb,
  Button,
  Drawer,
  notification,
  Space,
  Table,
  type TableProps,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useEffect, useState } from "react";
import contentApi, { type SortOptions } from "../../../api/contentApi";
import ContentAssetDetailsPanel from "../../../components/content/ContentAssetDetailsPanel";
import ContentAssetExpanderRow from "../../../components/content/ContentAssetExpanderRow";
import ContentAssetRating from "../../../components/content/ContentAssetRating";
import ContentAssetSizeDisplay from "../../../components/content/ContentAssetSizeDisplay";
import ContentAssetStatistics from "../../../components/content/ContentAssetStatistics";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import Timestamp from "../../../components/data/Timestamp";
import { useAppSelector } from "../../../redux/hooks";

export interface ContentAssetTag {
  id: string;
  createdTime: string;
  name: string;
  type: "type" | "source" | "system" | "user";
}

export interface ContentAsset {
  id: string;
  originalName: string;
  originalSha: string;
  originalSizeBytes: number;
  newSha: string;
  newSizeBytes: number;
  durationMs: number;
  width: number;
  height: number;
  name: string;
  createdTime: string;
  rating: number;
  tags: ContentAssetTag[];
}

type OnChange = NonNullable<TableProps<ContentAsset>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

type NotificationType = "success" | "info" | "warning" | "error";

const ContentAssetsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [api, contextHolder] = notification.useNotification();

  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [assets, setAssets] = useState<any>();
  const [assetsLoading, setAssetsLoading] = useState<any>(true);
  const [assetsError, setAssetsError] = useState<any>();
  const [assetsCount, setAssetsCount] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [assetsSort, setAssetsSort] = useState<SortOptions>({
    field: "createdTime",
    order: "desc",
  });
  const [assetPanelTarget, setAssetPanelTarget] = useState<string | undefined>(
    undefined,
  );

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

  const fetchAssets = async (quiet = false) => {
    if (!quiet) {
      setAssetsLoading(true);
    }
    setAssetsError(undefined);

    try {
      const listAssetsResponse = await contentApi.listAssets(
        assetsPage,
        assetsSort,
      );
      setAssets(listAssetsResponse.data.assets);
      setAssetsCount(listAssetsResponse.data.count);
    } catch (e) {
      setAssetsError(e);
      openNotificationWithIcon("error", "Unable to load asset list", "Poop");
    } finally {
      setAssetsLoading(false);
    }
  };

  useEffect(() => {
    setAssetsPage(0);
  }, [blackCurtainEnabled]);

  useEffect(() => {
    (async () => {
      await fetchAssets();
    })();
  }, [assetsPage, assetsSort, blackCurtainEnabled]);

  const columns: ColumnsType<ContentAsset> = [
    {
      key: "content_id",
      title: "ID",
      dataIndex: "id",
      render: (value, record, index) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Space direction={"vertical"} size={2}>
              <Typography.Link
                copyable={true}
                onClick={() => {
                  router.push(
                    `/dionysus/content/asset/${record.id}`,
                    `/dionysus/content/asset/${record.id}`,
                    {
                      shallow: true,
                    },
                  );
                }}
              >
                {value}
              </Typography.Link>
              <Typography.Text
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {record.name || record.originalName}
              </Typography.Text>
            </Space>
          </Space>
        );
      },
      sorter: true,
      ellipsis: true,
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
      key: "duration",
      title: "Duration",
      dataIndex: "durationMs",
      render: (value, record, index) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography.Text>{prettyMilliseconds(value)}</Typography.Text>
          </Space>
        );
      },
      sorter: true,
      width: 150,
    },
    {
      key: "width",
      title: "Width",
      dataIndex: "width",
      render: (value, record, index) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography.Text>{value}px</Typography.Text>
          </Space>
        );
      },
      sorter: true,
      width: 150,
    },
    {
      key: "height",
      title: "Height",
      dataIndex: "height",
      render: (value, record, index) => {
        return (
          <Space direction={"horizontal"} size={8} align={"center"}>
            <Typography.Text>{value}px</Typography.Text>
          </Space>
        );
      },
      sorter: true,
      width: 150,
    },
    {
      key: "asset_size",
      title: "Size",
      dataIndex: "size",
      render: (value, record, index) => {
        return <ContentAssetSizeDisplay asset={record} />;
      },
      sorter: true,
      width: 375,
    },
    {
      key: "rating",
      title: "Rating",
      dataIndex: "rating",
      render: (value, record, index) => {
        return (
          <Space direction={"vertical"}>
            <ContentAssetRating
              asset={record}
              onRatingSet={async (value) => {
                openNotificationWithIcon(
                  "success",
                  "Success",
                  "Rating set successfully.",
                );

                await fetchAssets(true);
              }}
            />
          </Space>
        );
      },
      sorter: true,
      width: 175,
    },
    {
      key: "info",
      title: "Info",
      render: (value, record, index) => {
        return (
          <Button
            type={"text"}
            onClick={() => {
              setAssetPanelTarget(record.id);
            }}
          >
            <InfoCircleOutlined />
          </Button>
        );
      },
      sorter: false,
      width: 64,
    },
  ];

  return (
    <ContentAuthWrapper>
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
              <Link href={"/content"}>
                <Space size={4}>
                  <ExperimentOutlined />
                  <span>Content</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space>
                <VideoCameraOutlined />
                <span>Assets</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          background: "#fff",
        }}
      >
        <Content
          style={{
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <ContentAssetStatistics />
          <Table
            style={{ width: "100%" }}
            rowKey={"id"}
            columns={columns}
            dataSource={assets}
            size={"middle"}
            loading={assetsLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              position: ["bottomLeft"],
              pageSize: 15,
              size: "small",
              total: assetsCount,
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
                  setAssetsPage(pagination.current! - 1);
                  break;
                case "sort":
                  setAssetsSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  break;
                case "filter":
                  break;
              }
            }}
            expandable={{
              expandIcon: ({ expanded, onExpand, record }) => (
                <Space
                  style={{ margin: 0, padding: 0 }}
                  onClick={(e) => onExpand(record, e)}
                >
                  <Avatar
                    shape={"square"}
                    src={`https://content-cdn.sea.ncfritz.net:9443/assets/${record.id}/thumbnails/8.png`}
                  />
                </Space>
              ),
              expandedRowRender: (record) => (
                <ContentAssetExpanderRow
                  record={record}
                  reloadAssets={fetchAssets}
                />
              ),
            }}
          />
          <Drawer
            title={"Asset Details"}
            width={750}
            placement={"right"}
            closable={true}
            styles={{
              body: {
                padding: 0,
              },
            }}
            onClose={() => {
              setAssetPanelTarget(undefined);
            }}
            open={assetPanelTarget !== undefined}
          >
            <ContentAssetDetailsPanel assetId={assetPanelTarget!} />
          </Drawer>
        </Content>
      </Content>
    </ContentAuthWrapper>
  );
};

export default ContentAssetsPage;
