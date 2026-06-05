import { DateTime } from "luxon";
import dynamic from "next/dynamic";
import { FilterFilled, HomeOutlined } from "@ant-design/icons";
import type {
  FilterDefinition,
  GetMovieAggregateStatisticsResponse,
  Language,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import {
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
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import { useDebounce } from "use-debounce";
import type { SortOptions } from "../../api/common";
import metadataApi from "../../api/metadataApi";
import LoadingWrapper from "../../components/common/LoadingWrapper";
import CheckboxFilter from "../../components/dionysus/metadata/filter/CheckboxFilter";
import DateRangeFilter, {
  type DateRangeFilterValue,
} from "../../components/dionysus/metadata/filter/DateRangeFilter";
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
import { v4 as uuidv4 } from "uuid";

const MoviesIndexPage: React.FunctionComponent = () => {
  const now = DateTime.utc();
  const movieListContainerId = uuidv4();

  const [sort, setSort] = useState<SortOptions>({
    field: "popularity",
    order: "desc",
  });
  const [moviesPage, setMoviesPage] = useState(0);
  const [movieCount, setMovieCount] = useState(0);
  const [aggregateMovies, setAggregateMovies] = useState<SparseMovie[]>([]);
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(["Released"]);
  const [videoFilter, setVideoFilter] = useState<("f" | "v")[]>(["f"]);
  const [releaseDateFilter, setReleaseDateFilter] = useState<
    DateRangeFilterValue | undefined
  >({
    start: { month: now.month, year: now.year - 1 },
    end: { month: now.month, year: now.year },
  });
  const [spokenLanguageFilter, setSpokenLanguageFilter] = useState<string[]>(
    [],
  );
  const [missingFilter, setMissingFilter] = useState(false);
  const [monitoredFilter, setMonitoredFilter] = useState(false);
  const [filters, setFilters] = useState<FilterDefinition | undefined>(
    undefined,
  );
  const [affix, setAffix] = useState(false);

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

    if (releaseDateFilter) {
      const startDate = DateTime.fromObject({
        month: releaseDateFilter.start.month,
        year: releaseDateFilter.start.year,
      });
      const endDate = DateTime.fromObject({
        month: releaseDateFilter.end.month,
        year: releaseDateFilter.end.year,
      });
      newFilters.push({
        type: "and",
        name: "_",
        value: [
          { type: "gte", name: "releaseDate", value: startDate.toISODate()! },
          { type: "lte", name: "releaseDate", value: endDate.toISODate()! },
        ],
      });
    }

    if (missingFilter) {
      newFilters.push({
        type: "exists",
        name: "asset",
        value: false,
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

    setMoviesPage(0);
    setInitialFiltersSet(true);
  }, [
    debouncedTitleFilter,
    statusFilter,
    videoFilter,
    spokenLanguageFilter,
    releaseDateFilter,
    monitoredFilter,
    missingFilter,
  ]);

  const [movies, moviesLoading, moviesError, fetchMovies] = useFetch<
    undefined,
    SparseMovie[]
  >({
    dataType: "movies",
    watch: [sort, filters, moviesPage],
    params: undefined,
    beforeDataRequest: async (params) => {
      if (moviesPage === 0) {
        setAggregateMovies([]);
      }
    },
    validateOptions: (options) => {
      console.log("InitialFiltersSet: ", initialFiltersSet);
      console.log("Filters: ", filters);
      return initialFiltersSet;
    },
    fetchFunction: async () => {
      console.log("Fetching movies, page: ", moviesPage);
      const response = await metadataApi.listMovies(
        moviesPage,
        48,
        sort,
        filters,
      );
      setMovieCount(response.data.count);
      return response.data.movies;
    },
    onDataFetched: async (data) => {
      setAggregateMovies((prev) => [...prev, ...data]);
      if (moviesPage === 0) {
        setMoviesPage(moviesPage + 1);
      }
    },
  });

  const [languages, languagesLoading, languagesError] = useFetch<
    undefined,
    Language[]
  >({
    dataType: "languages",
    watch: [],
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

  const fetchNextMoviesPage = async () => {
    console.log("fetching next page: ", moviesPage);
    setMoviesPage(moviesPage + 1);

    //await fetchMovies(true);
  };

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
      <OlympusBreadcrumbs
        className={"dark"}
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
      <Layout
        id={movieListContainerId}
        style={{
          position: "relative",
          background: "#ffffff",
          overflowX: "hidden",
          overflowY: "scroll",
          scrollbarWidth: "none",
          height: "calc(100vh - 92px)",
        }}
        onScroll={(e) => {
          setAffix(e.currentTarget.scrollTop >= 548);
        }}
      >
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
          orientation={"horizontal"}
          size={8}
          style={{
            position: affix ? "sticky" : "relative",
            scrollBehavior: "smooth",
            top: affix ? 0 : undefined,
            backgroundColor: "#efefef",
            width: "100%",
            padding: 8,
            justifyContent: "space-between",
            zIndex: 4,
          }}
        >
          <Space direction={"horizontal"} size={8}>
            <Input
              size={"small"}
              prefix={
                <FilterFilled
                  style={{
                    color:
                      debouncedTitleFilter?.length >= 3 ? "#1677ff" : "#afafaf",
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
                setTitleFilter(e.target.value);
              }}
            />
            <CheckboxFilter
              label={"Status"}
              initialValues={statusFilter}
              items={[
                "Released",
                "Post Production",
                "In Production",
                "Planned",
                "Rumored",
                "Canceled",
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
              initialValues={videoFilter}
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
            <DateRangeFilter
              initialValue={releaseDateFilter}
              label={"Release Date"}
              onFiltersSet={setReleaseDateFilter}
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
            <Typography.Text style={{ fontSize: "12px" }}>
              Missing
            </Typography.Text>
            <Switch
              size={"small"}
              checked={missingFilter}
              onChange={setMissingFilter}
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
          orientation={"vertical"}
          style={{
            width: "100%",
            padding: 16,
            paddingTop: affix ? 0 : 16,
            top: affix ? 92 + 42 : undefined,
          }}
        >
          <LoadingWrapper loading={moviesLoading} error={moviesError}>
            <MovieList
              movies={aggregateMovies}
              loading={moviesLoading}
              afterSearchUpdate={async () => {
                await fetchMovies(true);
              }}
              scrollOptions={{
                fetchNextPage: fetchNextMoviesPage,
                itemCount: movieCount,
                target: movieListContainerId,
              }}
            />
          </LoadingWrapper>
        </Space>
      </Layout>
    </>
  );
};

export default MoviesIndexPage;
