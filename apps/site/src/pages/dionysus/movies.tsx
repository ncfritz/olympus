import dynamic from "next/dynamic";
import { HomeOutlined } from "@ant-design/icons";
import type {
  FilterDefinition,
  GetMovieAggregateStatisticsResponse,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { Col, Layout, Row, Space, Statistic } from "antd";
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { useState } from "react";
import type { SortOptions } from "../../api/common";
import metadataApi from "../../api/metadataApi";
import LoadingWrapper from "../../components/common/LoadingWrapper";
import MovieFilterBar from "../../components/dionysus/metadata/MovieFilterBar";
import MovieList from "../../components/dionysus/metadata/MovieList";
import MovieReleaseStatusStatisticsChart from "../../components/dionysus/metadata/movies/MovieReleaseStatusStatisticsChart";
import MovieReleaseYearStatisticsChart from "../../components/dionysus/metadata/movies/MovieReleaseYearStatisticsChart";
import MovieRuntimeStatisticsChart from "../../components/dionysus/metadata/movies/MovieRuntimeStatisticsChart";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../icons";
const MovieLocationsMap = dynamic(
  () => import("../../components/dionysus/metadata/movies/MovieLocationsMap"),
  { ssr: false },
);
import { v4 as uuidv4 } from "uuid";

const MoviesIndexPage: React.FunctionComponent = () => {
  const movieListContainerId = uuidv4();

  const [sort, setSort] = useState<SortOptions>({
    field: "popularity",
    order: "desc",
  });
  const [moviesPage, setMoviesPage] = useState(0);
  const [movieCount, setMovieCount] = useState(0);
  const [aggregateMovies, setAggregateMovies] = useState<SparseMovie[]>([]);
  const [initialFiltersSet, setInitialFiltersSet] = useState(false);
  const [filters, setFilters] = useState<FilterDefinition | undefined>(
    undefined,
  );
  const [affix, setAffix] = useState(false);

  const [movies, moviesLoading, moviesError, fetchMovies] = useFetch<
    undefined,
    SparseMovie[]
  >({
    dataType: "movies",
    watch: [sort, filters, moviesPage],
    params: undefined,
    beforeDataRequest: async () => {
      if (moviesPage === 0) {
        setAggregateMovies([]);
      }
    },
    validateOptions: () => {
      return initialFiltersSet;
    },
    fetchFunction: async () => {
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

  const fetchNextMoviesPage = async () => {
    console.log("fetching next page: ", moviesPage);
    setMoviesPage(moviesPage + 1);
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
              value={statsLoading ? 0 : stats ? stats.count : "Unknown"}
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
                  : stats.averageRuntime
                    ? prettyMilliseconds(stats.averageRuntime * 60 * 1000, {
                        formatSubMilliseconds: false,
                        secondsDecimalDigits: 0,
                      })
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
              title={"Avg Budget"}
              value={
                statsLoading
                  ? 0
                  : stats.averageBudget
                    ? stats.averageBudget.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
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
              title={"Avg Revenue"}
              value={
                statsLoading
                  ? 0
                  : stats.averageRevenue
                    ? stats.averageRevenue.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
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
              title={"Max Revenue"}
              value={
                statsLoading
                  ? 0
                  : stats.maxRevenue
                    ? stats.maxRevenue.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
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
            width: "100%",
            zIndex: 4,
          }}
          styles={{ item: { width: "100%" } }}
        >
          <MovieFilterBar
            onFiltersSet={(filters) => {
              setFilters(filters);
              setMoviesPage(0);
              setInitialFiltersSet(true);
            }}
            onSortSet={(sort) => {
              setSort(sort);
            }}
          />
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
