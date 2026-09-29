import { InfoCircleOutlined, SearchOutlined } from "@ant-design/icons";
import type {
  ContentAsset,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Avatar,
  Button,
  notification,
  Space,
  Table,
  type TableProps,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import prettyMilliseconds from "pretty-ms";
import { useEffect, useState } from "react";
import type { SortOptions } from "../../api/common";
import contentApi from "../../api/contentApi";
import { useFetch } from "../../hooks/useFetch";
import { useAppSelector } from "../../redux/hooks";
import Timestamp from "../data/Timestamp";
import ContentAssetExpanderRow from "./ContentAssetExpanderRow";
import ContentAssetRating from "./ContentAssetRating";
import ContentAssetSizeDisplay from "./ContentAssetSizeDisplay";

type OnChange = NonNullable<TableProps<ContentAsset>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

export interface ContentAssetTableProps {
  filters?: FilterDefinition;
  onInfoButtonClick?: (record: ContentAsset) => void;
  onSearchButtonClick?: () => void;
  searchButtonVisible?: boolean;
  scrollY: string;
  pageSize?: number;
  initialSort: SortOptions;
}

const ContentAssetTable: React.FunctionComponent<ContentAssetTableProps> = ({
  filters,
  onInfoButtonClick,
  onSearchButtonClick,
  searchButtonVisible,
  scrollY,
  pageSize = 30,
  initialSort = {
    field: "createdTime",
    order: "desc",
  },
}: ContentAssetTableProps) => {
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [assetsCount, setAssetsCount] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [assetsSort, setAssetsSort] = useState<SortOptions>(initialSort);

  const [api] = notification.useNotification();

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

  useEffect(() => {
    setAssetsPage(0);
  }, [blackCurtainEnabled]);

  const columns: ColumnsType<ContentAsset> = [
    {
      key: "content_id",
      title: "ID",
      dataIndex: "id",
      render: (value, record) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
            <Space orientation={"vertical"} size={2}>
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
      render: (value) => {
        return <Timestamp value={value} />;
      },
      sorter: true,
      width: 200,
    },
    {
      key: "duration",
      title: "Duration",
      dataIndex: "durationMs",
      render: (value) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
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
      render: (value) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
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
      render: (value) => {
        return (
          <Space orientation={"horizontal"} size={8} align={"center"}>
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
      render: (value, record) => {
        return <ContentAssetSizeDisplay asset={record} />;
      },
      sorter: true,
      width: 375,
    },
    {
      key: "rating",
      title: "Rating",
      dataIndex: "rating",
      render: (value, record) => {
        return (
          <Space orientation={"vertical"}>
            <ContentAssetRating
              asset={record}
              onRatingSet={async () => {
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
  ];

  if (onInfoButtonClick) {
    columns.push({
      key: "info",
      title: "Info",
      render: (value, record) => {
        return (
          <Button
            type={"text"}
            onClick={() => {
              onInfoButtonClick(record);
            }}
          >
            <InfoCircleOutlined />
          </Button>
        );
      },
      sorter: false,
      width: 64,
    });
  }

  return (
    <Table
      style={{ width: "100%" }}
      rowKey={"id"}
      columns={columns}
      sticky={true}
      scroll={{ y: scrollY }}
      dataSource={assets}
      size={"small"}
      loading={assetsLoading}
      pagination={{
        style: {
          marginLeft: 16,
        },
        position: ["bottomLeft"],
        pageSize: pageSize,
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
        expandIcon: ({ onExpand, record }) => (
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
          <ContentAssetExpanderRow record={record} reloadAssets={fetchAssets} />
        ),
        columnTitle: searchButtonVisible ? (
          <Button type={"text"} size={"small"} onClick={onSearchButtonClick}>
            <SearchOutlined />
          </Button>
        ) : undefined,
      }}
    />
  );
};
export default ContentAssetTable;
