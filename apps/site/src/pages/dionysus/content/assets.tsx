import {
  ExperimentOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAssetTag,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Avatar,
  Breadcrumb,
  Button,
  Drawer,
  notification,
  Space,
  Splitter,
  Table,
  type TableProps,
  Typography,
} from "antd";
import { type ColumnsType } from "antd/es/table";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import type { SortOptions } from "../../../api/common";
import contentApi from "../../../api/contentApi";
import ContentAssetDetailsPanel from "../../../components/content/ContentAssetDetailsPanel";
import ContentAssetExpanderRow from "../../../components/content/ContentAssetExpanderRow";
import ContentAssetFilterPanel from "../../../components/content/ContentAssetFilterPanel";
import ContentAssetRating from "../../../components/content/ContentAssetRating";
import ContentAssetSizeDisplay from "../../../components/content/ContentAssetSizeDisplay";
import ContentAssetStatistics from "../../../components/content/ContentAssetStatistics";
import ContentAuthWrapper from "../../../components/content/ContentAuthWrapper";
import Timestamp from "../../../components/data/Timestamp";
import { useFetch } from "../../../hooks/useFetch";
import { useAppSelector } from "../../../redux/hooks";

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

const ContentAssetsPage: React.FunctionComponent = () => {
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [api] = notification.useNotification();

  const [assetsCount, setAssetsCount] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [assetsSort, setAssetsSort] = useState<SortOptions>({
    field: "createdTime",
    order: "desc",
  });
  const [assetPanelTarget, setAssetPanelTarget] = useState<string | undefined>(
    undefined,
  );
  const [filterPanelSize, setFilterPanelSize] = useState(300);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterDefinition | undefined>(
    undefined,
  );
  const [assets, assetsLoading, assetsError, fetchAssets] = useFetch<
    undefined,
    ContentAsset[]
  >({
    dataType: "content assets",
    params: undefined,
    watch: [assetsPage, assetsSort, blackCurtainEnabled, filters],
    fetchFunction: async () => {
      const response = (
        await contentApi.listAssets(assetsPage, assetsSort, filters)
      ).data;
      setAssetsCount(response.count);
      return response.assets;
    },
  });

  const addFilter = async (tag: ContentAssetTag) => {
    const key = `${tag.type}:${tag.name}`;

    if (!selectedFilters.includes(key)) {
      const newFilters = [...selectedFilters];
      newFilters.push(key);

      setSelectedFilters(newFilters);
    }
  };

  const removeFilter = async (tag: ContentAssetTag) => {
    const key = `${tag.type}:${tag.name}`;

    if (selectedFilters.includes(key)) {
      const newFilters = [...selectedFilters].filter((value) => {
        return value !== key;
      });

      setSelectedFilters(newFilters);
    }
  };

  const toggleFilters = () => {
    setFilterPanelSize(filterPanelSize <= 0 ? 300 : 0);
  };

  const appendFilterDefinition = (
    type: string,
    logic: "and" | "or",
    chain: FilterDefinition[],
  ) => {
    const selectedValues = selectedFilters
      .filter((value) => value.startsWith(`${type}:`))
      .map((value) => value.substring(value.indexOf(":") + 1, value.length));
    let values: string[] | FilterDefinition[] = selectedValues;

    if (logic === "and") {
      values = selectedValues.map<FilterDefinition>((value) => {
        return {
          type: "eq",
          name: "asset_tags.tag.name",
          value: value,
        };
      });
    }

    if (selectedValues.length > 0) {
      chain.push({
        type: "and",
        name: "__and",
        value: [
          {
            type: "eq",
            name: "asset_tags.tag.type",
            value: type,
          },
          {
            type: logic === "and" ? "and" : "in",
            name: logic === "and" ? "__and" : "asset_tags.tag.name",
            value: values,
          },
        ],
      });
    }
  };

  useEffect(() => {
    const newFilters: FilterDefinition[] = [];
    appendFilterDefinition("type", "or", newFilters);
    appendFilterDefinition("source", "or", newFilters);
    appendFilterDefinition("user", "and", newFilters);
    appendFilterDefinition("model", "or", newFilters);
    appendFilterDefinition("system", "and", newFilters);

    if (newFilters.length > 1) {
      setFilters({ type: "and", name: "__base", value: newFilters });
    } else {
      setFilters(newFilters[0]);
    }
  }, [selectedFilters]);

  useEffect(() => {
    setAssetsPage(0);
  }, [blackCurtainEnabled]);

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
                href={`/dionysus/content/asset/${record.id}`}
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
                api["success"]({
                  message: "Success",
                  description: "The rating was set successfully",
                });

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
            height: "calc(100vh - 102px)",
            overflowX: "hidden",
            overflowY: "auto",
          }}
        >
          <ContentAssetStatistics />
          <Splitter
            style={{
              height: "calc(100vh - 399px)",
            }}
            onResize={(sizes) => {
              setFilterPanelSize(filterPanelSize <= 0 ? 300 : 0);
            }}
          >
            <Splitter.Panel
              min={0}
              max={300}
              size={filterPanelSize}
              resizable={false}
              collapsible={true}
              style={{
                scrollbarWidth: "none",
              }}
            >
              <ContentAssetFilterPanel
                togglePanel={toggleFilters}
                onSelectTag={addFilter}
                onRemoveTag={removeFilter}
              />
            </Splitter.Panel>
            <Splitter.Panel>
              <Table
                style={{ width: "100%" }}
                rowKey={"id"}
                columns={columns}
                sticky={true}
                scroll={{ y: "calc(100vh - 494px)" }}
                dataSource={assets}
                size={"small"}
                loading={assetsLoading}
                pagination={{
                  style: {
                    marginLeft: 16,
                  },
                  position: ["bottomLeft"],
                  pageSize: 30,
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
                  columnTitle:
                    filterPanelSize <= 0 ? (
                      <Button
                        type={"text"}
                        size={"small"}
                        onClick={toggleFilters}
                      >
                        <SearchOutlined />
                      </Button>
                    ) : undefined,
                }}
              />
            </Splitter.Panel>
          </Splitter>
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
