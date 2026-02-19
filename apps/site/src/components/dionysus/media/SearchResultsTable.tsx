import { DownloadOutlined } from "@ant-design/icons";
import type {
  Country,
  FilterDefinition,
  MediaAssetSearchConfiguration,
  MediaAssetSearchResult,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  ConfigProvider,
  Empty,
  Space,
  Table,
  type TableProps,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DateTime } from "luxon";
import prettyBytes from "pretty-bytes";
import React, { useState } from "react";
import type { SortOptions } from "../../../api/common";
import mediaApi from "../../../api/mediaApi";
import { useFetch } from "../../../hooks/useFetch";
import { buildFilterDefinitionForTable } from "../../../utils/filters";
import { getGradientAtPercent } from "../../../utils/gradient";
import ErrorBlock from "../../common/ErrorBlock";
import Timestamp from "../../data/Timestamp";
import SearchResultTag from "./SearchResultTag";
import {
  getGroupColor, getGroupTag,
  getModifier,
  getResolutionTag,
  getResolutionTransparency,
  getSource
} from "./utils";

type OnChange = NonNullable<TableProps<Country>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

export interface SearchResultsTableProps {
  searchConfiguration: MediaAssetSearchConfiguration;
}

const SearchResultsTable: React.FunctionComponent<SearchResultsTableProps> = ({
  searchConfiguration,
}: SearchResultsTableProps) => {
  const [searchResultsCount, setSearchResultsCount] = useState(0);
  const [searchResultsPage, setSearchResultsPage] = useState(0);
  const [searchResultsSort, setSearchResultsSort] = useState<SortOptions>({
    field: "postedTime",
    order: "desc",
  });
  const [searchResultsFilters, setSearchResultsFilters] = useState<
    FilterDefinition | undefined
  >(undefined);

  const [searchResults, searchResultsLoading, searchResultsError] = useFetch<
    undefined,
    MediaAssetSearchResult[]
  >({
    dataType: "search results",
    watch: [
      searchConfiguration,
      searchResultsPage,
      searchResultsSort,
      searchResultsFilters,
    ],
    params: undefined,
    fetchFunction: async () => {
      const response = await mediaApi.listMediaAssetSearchResults(
        searchConfiguration.type,
        searchConfiguration.mediaId,
        searchResultsPage,
        50,
        searchResultsSort,
        searchResultsFilters,
      );
      setSearchResultsCount(response.data.count);
      return response.data.searchResults;
    },
  });

  const handleStartDownload = async (id: string) => {};

  const now = DateTime.now();

  const columns: ColumnsType<MediaAssetSearchResult> = [
    {
      key: "id",
      title: "Title",
      dataIndex: "title",
      render: (value, record) => {
        return (
          <Space
            direction={"vertical"}
            styles={{ item: { lineHeight: "11px" } }}
            size={2}
          >
            <Typography.Text
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              {record.title}
            </Typography.Text>
          </Space>
        );
      },
      sorter: true,
    },
    {
      key: "qualityGroup",
      title: "Group",
      dataIndex: "qualityGroup",
      render: (value) => {
        return (
          <SearchResultTag color={getGroupColor(value)}>
            {value}
          </SearchResultTag>
        );
      },
      filters: [
        {
          text: getGroupTag("Pre-Release"),
          value: "Pre-Release",
        },
        {
          text: getGroupTag("SD"),
          value: "SD",
        },
        {
          text: getGroupTag("HDTV"),
          value: "HDTV",
        },
        {
          text: getGroupTag("Bluray"),
          value: "Bluray",
        },
        {
          text: getGroupTag("WEBDL"),
          value: "WEBDL",
        },
        {
          text: getGroupTag("WEBRip"),
          value: "WEBRip",
        },
        {
          text: getGroupTag("Unknown"),
          value: "Unknown",
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 100,
    },
    {
      key: "quality",
      title: "Quality",
      dataIndex: "quality",
      render: (value, item) => {
        return (
          <SearchResultTag
            color={`${getGroupColor(item.qualityGroup)}${getResolutionTransparency(item.resolution)}`}
          >
            {value}
          </SearchResultTag>
        );
      },
      sorter: true,
      width: 150,
    },
    {
      key: "resolution",
      title: "Res",
      dataIndex: "resolution",
      render: (value) => {
        return getResolutionTag(value);
      },
      filters: [
        {
          text: getResolutionTag(360),
          value: 360,
        },
        {
          text: getResolutionTag(480),
          value: 480,
        },
        {
          text: getResolutionTag(540),
          value: 540,
        },
        {
          text: getResolutionTag(576),
          value: 576,
        },
        {
          text: getResolutionTag(720),
          value: 720,
        },
        {
          text: getResolutionTag(1080),
          value: 1080,
        },
        {
          text: getResolutionTag(2160),
          value: 2160,
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 90,
    },
    {
      key: "source",
      title: "Source",
      dataIndex: "source",
      render: (value) => {
        return getSource(value);
      },
      filters: [
        {
          text: getSource(1),
          value: 1,
        },
        {
          text: getSource(2),
          value: 2,
        },
        {
          text: getSource(3),
          value: 3,
        },
        {
          text: getSource(4),
          value: 4,
        },
        {
          text: getSource(5),
          value: 5,
        },
        {
          text: getSource(6),
          value: 6,
        },
        {
          text: getSource(7),
          value: 7,
        },
        {
          text: getSource(8),
          value: 8,
        },
        {
          text: getSource(9),
          value: 9,
        },
        {
          text: getSource(-1),
          value: false,
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 100,
    },
    {
      key: "modifier",
      title: "Mod",
      dataIndex: "modifier",
      render: (value) => {
        return getModifier(value);
      },
      filters: [
        {
          text: getModifier(1),
          value: 1,
        },
        {
          text: getModifier(2),
          value: 2,
        },
        {
          text: getModifier(3),
          value: 3,
        },
        {
          text: getModifier(4),
          value: 4,
        },
        {
          text: getModifier(5),
          value: 5,
        },
      ],
      filterMode: "tree",
      filterSearch: true,
      sorter: true,
      width: 90,
    },
    {
      key: "size",
      title: "Size",
      dataIndex: "size",
      render: (value) => {
        return (
          <Typography.Text
            style={{ fontSize: "11px", fontFamily: "monospace" }}
          >
            {prettyBytes(value)}
          </Typography.Text>
        );
      },
      sorter: true,
      width: 100,
    },
    {
      key: "postedTime",
      title: "Age",
      dataIndex: "postedTime",
      render: (value, record) => {
        const age = Math.round(
          now.diff(DateTime.fromISO(record.postedTime)).as("days"),
        );
        const freshness = age / (10 * 365);

        return (
          <SearchResultTag color={getGradientAtPercent(freshness)}>
            {`${age}d`}
          </SearchResultTag>
        );
      },
      sorter: true,
      width: 75,
    },
    {
      key: "created_at",
      title: "Created",
      dataIndex: "createdTime",
      render: (value) => {
        return <Timestamp value={value} direction={"horizontal"} />;
      },
      sorter: true,
      width: 120,
    },
    {
      key: "id",
      title: "",
      dataIndex: "id",
      render: (value) => {
        return (
          <Space
            direction={"horizontal"}
            style={{
              width: "100%",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Button
              size={"small"}
              icon={<DownloadOutlined />}
              type={"text"}
              onClick={async () => {
                await handleStartDownload(value);
              }}
            />
          </Space>
        );
      },
      sorter: false,
      width: 40,
    },
  ];

  return (
    <ConfigProvider
      renderEmpty={() =>
        searchResultsError ? (
          <ErrorBlock error={searchResultsError} />
        ) : (
          <Empty description="No search results found" />
        )
      }
    >
      <Table
        style={{ width: "100%" }}
        rowKey={"id"}
        columns={columns}
        sticky={true}
        scroll={{ y: "calc(100vh - 747px)" }}
        dataSource={searchResults}
        size={"small"}
        loading={searchResultsLoading}
        pagination={{
          style: {
            marginLeft: 16,
          },
          position: ["bottomLeft"],
          pageSize: 50,
          size: "small",
          total: searchResultsCount,
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
              setSearchResultsPage(pagination.current! - 1);
              break;
            case "sort":
              setSearchResultsSort({
                field: s.columnKey?.toString() || "",
                order: s.order === "ascend" ? "asc" : "desc",
              });
              setSearchResultsPage(0);
              break;
            case "filter":
              setSearchResultsPage(0);
              setSearchResultsFilters(buildFilterDefinitionForTable(filters));
              break;
          }
        }}
      />
    </ConfigProvider>
  );
};
export default SearchResultsTable;
