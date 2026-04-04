import dynamic from "next/dynamic";
import { FilterFilled, HomeOutlined } from "@ant-design/icons";
import type {
  BaseTvSeries,
  FilterDefinition,
  GetTvSeriesAggregateStatisticsResponse,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Affix,
  Col,
  Input,
  Layout,
  Row,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import type { SortOptions } from "../../../../api/common";
import metadataApi from "../../../../api/metadataApi";
import CheckboxFilter from "../../../../components/dionysus/metadata/filter/CheckboxFilter";
import SingleSelectionFilter from "../../../../components/dionysus/metadata/filter/SingleSelectionFilter";
import Sorter from "../../../../components/dionysus/metadata/filter/Sorter";
import MovieReleaseStatusStatisticsChart from "../../../../components/dionysus/metadata/movies/MovieReleaseStatusStatisticsChart";
import MovieReleaseYearStatisticsChart from "../../../../components/dionysus/metadata/movies/MovieReleaseYearStatisticsChart";
import MovieRuntimeStatisticsChart from "../../../../components/dionysus/metadata/movies/MovieRuntimeStatisticsChart";
import TvSeriesSeasonStatisticsChart from "../../../../components/dionysus/metadata/movies/TvSeriesSeasonStatisticsChart";
import TvSeriesList from "../../../../components/dionysus/metadata/TvSeriesList";
import { getStatusForTvSeries } from "../../../../components/dionysus/metadata/util";
import OlympusBreadcrumbs from "../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../../icons";
const MovieLocationsMap = dynamic(
  () =>
    import("../../../../components/dionysus/metadata/movies/MovieLocationsMap"),
  { ssr: false },
);

const TvSeriesIndexPage: React.FunctionComponent = () => {
  const [sort, setSort] = useState<SortOptions>({
    field: "popularity",
    order: "desc",
  });
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [monitoredFilter, setMonitoredFilter] = useState(false);

  const [filters, setFilters] = useState<FilterDefinition | undefined>(
    undefined,
  );

  const [debouncedTitleFilter] = useDebounce<string>(titleFilter, 300);

  useEffect(() => {
    const newFilters: FilterDefinition[] = [];

    if (debouncedTitleFilter.length >= 3) {
      newFilters.push({
        type: "ilike",
        name: "name",
        value: `%${debouncedTitleFilter}%`,
      });
    }

    if (statusFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "status",
        value: statusFilter,
      });
    }

    if (typeFilter) {
      newFilters.push({
        type: "eq",
        name: "type",
        value: typeFilter,
      });
    }

    if (monitoredFilter) {
      newFilters.push({
        type: "eq",
        name: "searchConfiguration.enabled",
        value: true,
      });
    }

    if (newFilters.length > 1) {
      setFilters({ type: "and", name: "__base", value: newFilters });
    } else {
      setFilters(newFilters[0]);
    }
  }, [debouncedTitleFilter, statusFilter, typeFilter]);

  const [tvSeries, tvSeriesLoading, tvSeriesError, fetchTvSeries] = useFetch<
    undefined,
    BaseTvSeries[]
  >({
    dataType: "TV series",
    watch: [sort, filters],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.listTvSeries(0, 48, sort, filters)).data.tvSeries,
  });

  const [stats, statsLoading, statsError] = useFetch<
    undefined,
    GetTvSeriesAggregateStatisticsResponse
  >({
    dataType: "TV series statistics",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getTvSeriesAggregateStatistics()).data,
  });

  return (
    <>
      <Affix offsetTop={64}>
        <OlympusBreadcrumbs
          items={[
            {
              title: (
                <Link href={"/public"}>
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
                    <MetadataOutlinedIcon />
                    <span>Dionysus</span>
                  </Space>
                </Link>
              ),
            },
            {
              title: (
                <Space>
                  <CertificationOutlined />
                  <span>Tv Series</span>
                </Space>
              ),
            },
          ]}
        />
      </Affix>
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 92,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 92px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>
          <Row gutter={8}>
            <Col span={15}>
              <Row>
                <Col span={12}>
                  <MovieReleaseYearStatisticsChart
                    size={5}
                    mediaType={"tv_series"}
                  />
                </Col>
                <Col span={12}>
                  <TvSeriesSeasonStatisticsChart />
                </Col>
              </Row>
              <Row>
                <Col span={12}>
                  <MovieReleaseStatusStatisticsChart mediaType={"tv_series"} />
                </Col>
                <Col span={12}>
                  <MovieRuntimeStatisticsChart mediaType={"tv_series"} />
                </Col>
              </Row>
            </Col>
            <Col span={9}>
              <MovieLocationsMap mediaType={"tv_series"} />
            </Col>
          </Row>
          <Row
            style={{
              borderTop: "1px solid #f0f0f0",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Count"}
                value={statsLoading ? 0 : stats.count}
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Total Seasons"}
                value={statsLoading ? 0 : stats.totalSeasons}
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Total Episodes"}
                value={statsLoading ? 0 : stats.totalEpisodes}
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Max Seasons"}
                value={statsLoading ? 0 : stats.maxSeasonCount}
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Max Episodes"}
                value={statsLoading ? 0 : stats.maxEpisodeCount}
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Average Seasons"}
                value={statsLoading ? 0 : stats.averageSeasonCount.toFixed(2)}
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Average Episodes"}
                value={statsLoading ? 0 : stats.averageEpisodeCount.toFixed(2)}
                loading={statsLoading}
              />
            </Col>
          </Row>
          <Space
            direction={"horizontal"}
            size={8}
            style={{
              backgroundColor: "#efefef",
              width: "100%",
              padding: 8,
              justifyContent: "space-between",
            }}
          >
            <Space direction={"horizontal"} size={8}>
              <Input
                size={"small"}
                prefix={
                  <FilterFilled
                    style={{
                      color:
                        debouncedTitleFilter?.length >= 3
                          ? "#1677ff"
                          : "#afafaf",
                    }}
                  />
                }
                placeholder={"Search by title"}
                allowClear={true}
                style={{
                  width: 500,
                  background: "#ffffff",
                  borderColor: "#efefef",
                }}
                value={titleFilter}
                onChange={(e) => {
                  setTitleFilter(e.target.value.trim());
                }}
              />
              <CheckboxFilter
                label={"Status"}
                items={[
                  "Canceled",
                  "Ended",
                  "In Production",
                  "Pilot",
                  "Planned",
                  "Returning Series",
                ].map((item) => {
                  const [statusText, statusColor] = getStatusForTvSeries(item);

                  return {
                    key: statusText,
                    label: (
                      <Tag color={statusColor} style={{ minWidth: 120 }}>
                        {statusText}
                      </Tag>
                    ),
                  };
                })}
                onFiltersSet={(values) => {
                  setStatusFilter(values as string[]);
                }}
              />
              <SingleSelectionFilter
                label={"Type"}
                items={[
                  "Documentary",
                  "Miniseries",
                  "News",
                  "Reality",
                  "Scripted",
                  "Talk Show",
                ].map((item) => {
                  return {
                    key: item,
                    label: item,
                  };
                })}
                onFiltersSet={(value) => {
                  setTypeFilter(value as string);
                }}
              />
            </Space>
            <Space direction={"horizontal"} size={8}>
              <Typography.Text style={{ fontSize: "12px" }}>
                Monitored
              </Typography.Text>
              <Switch
                size={"small"}
                checked={monitoredFilter}
                onChange={setMonitoredFilter}
              />
              <Sorter
                initialSort={sort.field}
                initialDirection={sort.order}
                sortOptions={{
                  popularity: "Popularity",
                  name: "Name",
                  firstAirDate: "First Air Date",
                  lastAirDate: "Last Air Date",
                  status: "Status",
                  type: "Type",
                }}
                onSortChange={(sort, direction) => {
                  setSort({
                    field: sort,
                    order: direction,
                  });
                }}
              />
            </Space>
          </Space>
          <Space
            size={16}
            direction={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            <TvSeriesList
              tvSeries={tvSeries}
              loading={tvSeriesLoading}
              afterSearchUpdate={async () => {
                await fetchTvSeries(true);
              }}
            />
          </Space>
        </Content>
      </Layout>
    </>
  );
};

export default TvSeriesIndexPage;
