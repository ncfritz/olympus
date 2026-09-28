import { DateTime } from "luxon";
import dynamic from "next/dynamic";
import {
  EyeFilled,
  FilterFilled,
  HeartFilled,
  HomeOutlined,
} from "@ant-design/icons";
import type {
  BaseTvSeries,
  FilterDefinition,
  Genre,
  GetTvSeriesAggregateStatisticsResponse,
  Language,
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
import React, { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import { useDebounce } from "use-debounce";
import { v4 as uuidv4 } from "uuid";
import type { SortOptions } from "../../../../api/common";
import metadataApi from "../../../../api/metadataApi";
import LoadingWrapper from "../../../../components/common/LoadingWrapper";
import CheckboxFilter from "../../../../components/dionysus/metadata/filter/CheckboxFilter";
import DateRangeFilter, {
  type DateRangeFilterValue,
} from "../../../../components/dionysus/metadata/filter/DateRangeFilter";
import NumericRangeFilter from "../../../../components/dionysus/metadata/filter/NumericRangeFilter";
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
  const now = DateTime.utc();
  const tvSeriesListContainerId = uuidv4();

  const [sort, setSort] = useState<SortOptions>({
    field: "popularity",
    order: "desc",
  });
  const [tvSeriesPage, setTvSeriesPage] = useState(0);
  const [tvSeriesCount, setTvSeriesCount] = useState(0);
  const [aggregateTvSeries, setAggregateTvSeries] = useState<BaseTvSeries[]>(
    [],
  );
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [firstAirDateFilter, setFirstAirDateFilter] = useState<
    DateRangeFilterValue | undefined
  >(undefined);
  const [lastAirDateFilter, setLastAirDateFilter] = useState<
    DateRangeFilterValue | undefined
  >({
    start: { month: now.month, year: now.year - 1 },
    end: { month: now.month, year: now.year },
  });
  const [spokenLanguageFilter, setSpokenLanguageFilter] = useState<string[]>(
    [],
  );
  const [genresFilter, setGenresFilter] = useState<string[]>([]);
  const [seasonsFilter, setSeasonsFilter] = useState<number[]>([]);
  const [originalLanguageFilter, setOriginalLanguageFilter] = useState<
    string[]
  >([]);
  const [monitoredFilter, setMonitoredFilter] = useState(false);
  const [favoriteFilter, setFavoriteFilter] = useState(false);
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

    if (firstAirDateFilter) {
      const startDate = DateTime.fromObject({
        month: firstAirDateFilter.start.month,
        year: firstAirDateFilter.start.year,
      });
      const endDate = DateTime.fromObject({
        month: firstAirDateFilter.end.month,
        year: firstAirDateFilter.end.year,
      });
      newFilters.push({
        type: "and",
        name: "_",
        value: [
          { type: "gte", name: "firstAirDate", value: startDate.toISODate()! },
          { type: "lte", name: "firstAirDate", value: endDate.toISODate()! },
        ],
      });
    }

    if (lastAirDateFilter) {
      const startDate = DateTime.fromObject({
        month: lastAirDateFilter.start.month,
        year: lastAirDateFilter.start.year,
      });
      const endDate = DateTime.fromObject({
        month: lastAirDateFilter.end.month,
        year: lastAirDateFilter.end.year,
      });
      newFilters.push({
        type: "and",
        name: "_",
        value: [
          { type: "gte", name: "firstAirDate", value: startDate.toISODate()! },
          { type: "lte", name: "firstAirDate", value: endDate.toISODate()! },
        ],
      });
    }

    if (genresFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "genres.genreId",
        value: genresFilter,
      });
    }

    if (seasonsFilter.length === 2) {
      newFilters.push({
        type: "and",
        name: "__runtime_and",
        value: [
          {
            type: "lte",
            name: "numberOfSeasons",
            value: seasonsFilter[1],
          },
          {
            type: "gte",
            name: "numberOfSeasons",
            value: seasonsFilter[0],
          },
        ],
      });
    }

    if (spokenLanguageFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "spokenLanguages.languageCode",
        value: spokenLanguageFilter,
      });
    }

    if (originalLanguageFilter.length > 0) {
      newFilters.push({
        type: "in",
        name: "original_language",
        value: originalLanguageFilter,
      });
    }

    if (monitoredFilter) {
      newFilters.push({
        type: "eq",
        name: "searchConfiguration.enabled",
        value: true,
      });
    }

    if (favoriteFilter) {
      newFilters.push({
        type: "exists",
        name: "favorite",
        value: true,
      });
    }

    if (newFilters.length > 1) {
      setFilters({ type: "and", name: "__base", value: newFilters });
    } else {
      setFilters(newFilters[0]);
    }

    setTvSeriesPage(0);
    setInitialFiltersSet(true);
  }, [
    debouncedTitleFilter,
    statusFilter,
    typeFilter,
    firstAirDateFilter,
    lastAirDateFilter,
    seasonsFilter,
    originalLanguageFilter,
    genresFilter,
    spokenLanguageFilter,
    monitoredFilter,
    favoriteFilter,
  ]);

  const [tvSeries, tvSeriesLoading, tvSeriesError, fetchTvSeries] = useFetch<
    undefined,
    BaseTvSeries[]
  >({
    dataType: "TV series",
    watch: [sort, filters, tvSeriesPage],
    params: undefined,
    beforeDataRequest: async (params) => {
      if (tvSeriesPage === 0) {
        setAggregateTvSeries([]);
      }
    },
    validateOptions: (options) => {
      return initialFiltersSet;
    },
    fetchFunction: async () => {
      const response = await metadataApi.listTvSeries(
        tvSeriesPage,
        48,
        sort,
        filters,
      );
      setTvSeriesCount(response.data.count);

      return response.data.tvSeries;
    },
    onDataFetched: async (data) => {
      setAggregateTvSeries((prev) => [...prev, ...data]);

      if (tvSeriesPage === 0) {
        setTvSeriesPage(tvSeriesPage + 1);
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

  const [genres, genresLoading, genresError] = useFetch<undefined, Genre[]>({
    dataType: "genres",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listGenres(0, 500, { field: "name", order: "desc" })
      ).data.genres.filter((genre) => genre.type === "TV"),
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

  const fetchNextTvSeriesPage = async () => {
    console.log("fetching next page: ", tvSeriesPage);
    setTvSeriesPage(tvSeriesPage + 1);
  };

  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
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
      <Layout
        id={tvSeriesListContainerId}
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
              value={statsLoading ? 0 : stats ? stats.count : "Unknown"}
              loading={statsLoading}
            />
          </Col>
          <Col
            span={3}
            style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
          >
            <Statistic
              title={"Total Seasons"}
              value={
                statsLoading
                  ? 0
                  : stats.totalSeasons
                    ? stats.totalSeasons
                    : "Unknown"
              }
              loading={statsLoading}
            />
          </Col>
          <Col
            span={3}
            style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
          >
            <Statistic
              title={"Total Episodes"}
              value={
                statsLoading
                  ? 0
                  : stats.totalEpisodes
                    ? stats.totalEpisodes
                    : "Unknown"
              }
              loading={statsLoading}
            />
          </Col>
          <Col
            span={3}
            style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
          >
            <Statistic
              title={"Max Seasons"}
              value={
                statsLoading
                  ? 0
                  : stats.maxSeasonCount
                    ? stats.maxSeasonCount
                    : "Unknown"
              }
              loading={statsLoading}
            />
          </Col>
          <Col
            span={3}
            style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
          >
            <Statistic
              title={"Max Episodes"}
              value={
                statsLoading
                  ? 0
                  : stats.maxEpisodeCount
                    ? stats.maxEpisodeCount
                    : "Unknown"
              }
              loading={statsLoading}
            />
          </Col>
          <Col
            span={3}
            style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
          >
            <Statistic
              title={"Average Seasons"}
              value={
                statsLoading
                  ? 0
                  : stats.averageEpisodeCount
                    ? stats.averageSeasonCount.toFixed(2)
                    : "Unknown"
              }
              loading={statsLoading}
            />
          </Col>
          <Col
            span={3}
            style={{ borderRight: "1px solid #f0f0f0", padding: 16 }}
          >
            <Statistic
              title={"Average Episodes"}
              value={
                statsLoading
                  ? 0
                  : stats.averageEpisodeCount
                    ? stats.averageEpisodeCount.toFixed(2)
                    : "Unknown"
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
          <Space orientation={"horizontal"} size={8}>
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
              items={[
                "Returning Series",
                "Pilot",
                "In Production",
                "Ended",
                "Planned",
                "Canceled",
              ].map((item) => {
                const [statusText, statusColor] = getStatusForTvSeries(item);

                return {
                  key: statusText,
                  label: (
                    <Tag
                      variant={"solid"}
                      color={statusColor}
                      style={{ minWidth: 120 }}
                    >
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
            <CheckboxFilter
              label={"Genre"}
              items={
                genres?.length > 0
                  ? genres.map((genre) => {
                      return {
                        key: genre.id,
                        label: <Typography.Text>{genre.name}</Typography.Text>,
                      };
                    })
                  : []
              }
              onFiltersSet={(values) => {
                setGenresFilter(values as string[]);
              }}
            />
            <NumericRangeFilter
              label={"Seasons"}
              min={1}
              max={50}
              tickInterval={5}
              onFiltersSet={setSeasonsFilter}
            />
            <DateRangeFilter
              initialValue={firstAirDateFilter}
              label={"First Aired"}
              onFiltersSet={setFirstAirDateFilter}
            />
            <DateRangeFilter
              initialValue={lastAirDateFilter}
              label={"Last Aired"}
              onFiltersSet={setLastAirDateFilter}
            />
            <CheckboxFilter
              label={"Spoken Language"}
              items={
                languages?.length > 0
                  ? languages.map((language) => {
                      return {
                        key: language.id,
                        label: (
                          <Space orientation={"horizontal"} size={8}>
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
            <CheckboxFilter
              label={"Original Language"}
              items={
                languages?.length > 0
                  ? languages.map((language) => {
                      return {
                        key: language.id,
                        label: (
                          <Space orientation={"horizontal"} size={8}>
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
                setOriginalLanguageFilter(values as string[]);
              }}
            />
          </Space>
          <Space orientation={"horizontal"} size={8}>
            <Typography.Text style={{ fontSize: "12px" }}>
              <EyeFilled
                style={{
                  fontSize: "18px",
                  color: monitoredFilter ? "#1672f3" : "#afafaf",
                }}
              />
            </Typography.Text>
            <Switch
              size={"small"}
              checked={monitoredFilter}
              onChange={setMonitoredFilter}
            />
            <Typography.Text style={{ fontSize: "12px" }}>
              <HeartFilled
                style={{
                  fontSize: "18px",
                  color: favoriteFilter ? "#1672f3" : "#afafaf",
                }}
              />
            </Typography.Text>
            <Switch
              size={"small"}
              checked={favoriteFilter}
              onChange={setFavoriteFilter}
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
          orientation={"vertical"}
          style={{
            width: "100%",
            padding: 16,
            paddingTop: affix ? 0 : 16,
            top: affix ? 92 + 42 : undefined,
          }}
        >
          <LoadingWrapper loading={tvSeriesLoading} error={tvSeriesError}>
            <TvSeriesList
              tvSeries={aggregateTvSeries}
              loading={tvSeriesLoading}
              scrollOptions={{
                fetchNextPage: fetchNextTvSeriesPage,
                itemCount: tvSeriesCount,
                target: tvSeriesListContainerId,
              }}
            />
          </LoadingWrapper>
        </Space>
      </Layout>
    </>
  );
};

export default TvSeriesIndexPage;
