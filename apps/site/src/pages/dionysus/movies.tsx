import dynamic from "next/dynamic";
import { FilterFilled, HomeOutlined } from "@ant-design/icons";
import type {
  FilterDefinition,
  GetMovieAggregateStatisticsResponse,
  Language,
  SparseMovie,
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
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import { useDebounce } from "use-debounce";
import type { SortOptions } from "../../api/common";
import metadataApi from "../../api/metadataApi";
import CheckboxFilter from "../../components/dionysus/metadata/filter/CheckboxFilter";
import Sorter from "../../components/dionysus/metadata/filter/Sorter";
import MovieList from "../../components/dionysus/metadata/MovieList";
import MovieReleaseStatusStatisticsChart from "../../components/dionysus/metadata/movies/MovieReleaseStatusStatisticsChart";
import MovieReleaseYearStatisticsChart from "../../components/dionysus/metadata/movies/MovieReleaseYearStatisticsChart";
import MovieRuntimeStatisticsChart from "../../components/dionysus/metadata/movies/MovieRuntimeStatisticsChart";
import { getReleaseStatusForMovie } from "../../components/dionysus/metadata/util";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../icons";
const MovieLocationsMap = dynamic(
  () => import("../../components/dionysus/metadata/movies/MovieLocationsMap"),
  { ssr: false },
);

const MoviesIndexPage: React.FunctionComponent = () => {
  const [sort, setSort] = useState<SortOptions>({
    field: "popularity",
    order: "desc",
  });
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [videoFilter, setVideoFilter] = useState<("f" | "v")[]>([]);
  const [spokenLanguageFilter, setSpokenLanguageFilter] = useState<string[]>(
    [],
  );
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
        name: "title",
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

    if (videoFilter.length > 0) {
      const allSelected = ["f", "v"].every((value: "f" | "v") =>
        videoFilter.includes(value),
      );

      if (!allSelected) {
        newFilters.push({
          type: "eq",
          name: "video",
          // If the first element is "a" - alive, we want to make sure that the deathday is null
          // otherwise, it must be set for a deceased person
          value: videoFilter[0] === "v",
        });
      }
    }

    if (spokenLanguageFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "spokenLanguages.languageCode",
        value: spokenLanguageFilter,
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
  }, [
    debouncedTitleFilter,
    statusFilter,
    videoFilter,
    spokenLanguageFilter,
    monitoredFilter,
  ]);

  const [movies, moviesLoading, moviesError, fetchMovies] = useFetch<
    undefined,
    SparseMovie[]
  >({
    dataType: "movies",
    watch: [sort, filters],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.listMovies(0, 48, sort, filters)).data.movies,
  });

  const [languages, languagesLoading, languagesError] = useFetch<
    undefined,
    Language[]
  >({
    dataType: "languages",
    watch: [sort, filters],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listLanguages(
          0,
          { field: "name", order: "desc" },
          500,
        )
      ).data.languages,
  });

  const [stats, statsLoading, statsError] = useFetch<
    undefined,
    GetMovieAggregateStatisticsResponse
  >({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getMovieAggregateStatistics()).data,
  });

  return (
    <>
      <Affix offsetTop={64}>
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
                  <span>Movies</span>
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
          height: "calc(100vh - 92)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>
          <Row gutter={8}>
            <Col span={15}>
              <Row>
                <Col span={24}>
                  <MovieReleaseYearStatisticsChart mediaType={"movies"} />
                </Col>
              </Row>
              <Row>
                <Col span={12}>
                  <MovieReleaseStatusStatisticsChart mediaType={"movies"} />
                </Col>
                <Col span={12}>
                  <MovieRuntimeStatisticsChart mediaType={"movies"} />
                </Col>
              </Row>
            </Col>
            <Col span={9}>
              <MovieLocationsMap mediaType={"movies"} />
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
                title={"Avg Runtime"}
                value={
                  statsLoading
                    ? 0
                    : prettyMilliseconds(stats.averageRuntime * 60 * 1000, {
                        formatSubMilliseconds: false,
                        secondsDecimalDigits: 0,
                      })
                }
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Avg Budget"}
                value={
                  statsLoading
                    ? 0
                    : stats.averageBudget.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
                }
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Avg Revenue"}
                value={
                  statsLoading
                    ? 0
                    : stats.averageRevenue.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
                }
                loading={statsLoading}
              />
            </Col>
            <Col
              span={3}
              style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
            >
              <Statistic
                title={"Max Revenue"}
                value={
                  statsLoading
                    ? 0
                    : stats.maxRevenue.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
                }
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
                  "In Production",
                  "Planned",
                  "Post Production",
                  "Released",
                  "Rumored",
                ].map((item) => {
                  const [statusText, statusColor] =
                    getReleaseStatusForMovie(item);

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
              <CheckboxFilter
                label={"Type"}
                items={[
                  { key: "f", label: "Feature" },
                  { key: "v", label: "Video" },
                ]}
                onFiltersSet={(values) => {
                  setVideoFilter(values as ("f" | "v")[]);
                }}
              />
              <CheckboxFilter
                label={"Spoken Language"}
                items={
                  languages?.length > 0
                    ? languages.map((language) => {
                        return {
                          key: language.id,
                          label: (
                            <Space direction={"horizontal"} size={8}>
                              <ReactCountryFlag
                                countryCode={language.id}
                                cdnUrl={"/flags/"}
                                cdnSuffix={"svg"}
                                svg={true}
                              />
                              <Typography.Text>{language.name}</Typography.Text>
                            </Space>
                          ),
                        };
                      })
                    : []
                }
                onFiltersSet={(values) => {
                  setSpokenLanguageFilter(values as string[]);
                }}
              />
            </Space>
            <Space direction={"horizontal"} size={8} align={"center"}>
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
                  title: "Title",
                  releaseDate: "Release Date",
                  budget: "Budget",
                  revenue: "Revenue",
                  status: "Status",
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
            <MovieList
              movies={movies}
              loading={moviesLoading}
              afterSearchUpdate={async () => {
                await fetchMovies(true);
              }}
            />
          </Space>
        </Content>
      </Layout>
    </>
  );
};

export default MoviesIndexPage;
