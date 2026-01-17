import {
  ExperimentOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type {
  ContentAsset,
  ContentAssetTag,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Avatar,
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
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { useAppSelector } from "../../../redux/hooks";

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
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(
    undefined,
  );
  const [durationFilter, setDurationFilter] = useState<number[] | undefined>(
    undefined,
  );
  const [resolutionFilter, setResolutionFilter] = useState<
    number[] | undefined
  >(undefined);
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
        await contentApi.listAssets(assetsPage, 30, assetsSort, filters)
      ).data;
      setAssetsCount(response.count);
      return response.assets;
    },
  });

  const addTagFilter = async (tag: ContentAssetTag) => {
    const key = `${tag.type}:${tag.name}`;

    if (!tagFilters.includes(key)) {
      const newFilters = [...tagFilters];
      newFilters.push(key);

      setTagFilters(newFilters);
    }
  };

  const removeTagFilter = async (tag: ContentAssetTag) => {
    const key = `${tag.type}:${tag.name}`;

    if (tagFilters.includes(key)) {
      const newFilters = [...tagFilters].filter((value) => {
        return value !== key;
      });

      setTagFilters(newFilters);
    }
  };

  const toggleFilters = () => {
    setFilterPanelSize(filterPanelSize <= 0 ? 300 : 0);
  };

  const appendTagFilterDefinition = (
    type: string,
    logic: "and" | "or",
    chain: FilterDefinition[],
  ) => {
    const selectedValues = tagFilters
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
    appendTagFilterDefinition("type", "or", newFilters);
    appendTagFilterDefinition("source", "or", newFilters);
    appendTagFilterDefinition("user", "and", newFilters);
    appendTagFilterDefinition("model", "or", newFilters);
    appendTagFilterDefinition("system", "and", newFilters);

    if (ratingFilter) {
      newFilters.push({
        name: "rating",
        type: "gte",
        value: ratingFilter,
      });
    }

    if (nameFilter) {
      newFilters.push({
        name: "_or",
        type: "or",
        value: [
          {
            name: "original_name",
            type: "ilike",
            value: `%${nameFilter}%`,
          },
          {
            name: "name",
            type: "ilike",
            value: `%${nameFilter}%`,
          },
        ],
      });
    }

    if (durationFilter) {
      newFilters.push({
        name: "_and",
        type: "and",
        value: [
          {
            name: "duration",
            type: "gte",
            value: durationFilter[0],
          },
          {
            name: "duration",
            type: "lte",
            value: durationFilter[1],
          },
        ],
      });
    }

    if (resolutionFilter) {
      newFilters.push({
        name: "_and",
        type: "and",
        value: [
          {
            name: "height",
            type: "gte",
            value: resolutionFilter[0],
          },
          {
            name: "height",
            type: "lte",
            value: resolutionFilter[1],
          },
        ],
      });
    }

    if (newFilters.length > 1) {
      setFilters({ type: "and", name: "__base", value: newFilters });
    } else {
      setFilters(newFilters[0]);
    }
  }, [tagFilters, nameFilter, ratingFilter, durationFilter, resolutionFilter]);

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
      <OlympusBreadcrumbs
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
              <Link href={"/dionysus"}>
                <Space size={4}>
                  <VideoCameraOutlined />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/content"}>
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
                onSelectTag={addTagFilter}
                onRemoveTag={removeTagFilter}
                onNameChange={setNameFilter}
                onRatingChange={setRatingFilter}
                onDurationChange={setDurationFilter}
                onResolutionChange={setResolutionFilter}
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
