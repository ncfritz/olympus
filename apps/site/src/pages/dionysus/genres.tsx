import { HomeOutlined } from "@ant-design/icons";
import type {
  FilterDefinition,
  GenreStatistic,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { Col, Layout, Row, Space } from "antd";
import Link from "next/link";
import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { SortOptions } from "../../api/common";
import metadataApi from "../../api/metadataApi";
import LoadingWrapper from "../../components/common/LoadingWrapper";
import MovieFilterBar from "../../components/dionysus/metadata/MovieFilterBar";
import MovieList from "../../components/dionysus/metadata/MovieList";
import GenreCountStatisticsChart from "../../components/dionysus/metadata/movies/GenreCountStatisticsChart";
import GenreStatisticsChart from "../../components/dionysus/metadata/movies/GenreStatisticsChart";
import GenreTagCloudChart from "../../components/dionysus/metadata/movies/GenreTagCloudChart";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../icons";

const GenresIndexPage: React.FunctionComponent = () => {
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
    beforeDataRequest: async (params) => {
      if (moviesPage === 0) {
        setAggregateMovies([]);
      }
    },
    validateOptions: (options) => {
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

  const [movieStats, movieStatsLoading, movieStatsError] = useFetch<
    undefined,
    GenreStatistic[]
  >({
    dataType: "movie genres",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getMovieGenreStatistics()).data.statistics,
  });

  const [tvSeriesStats, tvSeriesStatsLoading, tvSeriesStatsError] = useFetch<
    undefined,
    GenreStatistic[]
  >({
    dataType: "TV series genres",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getTvSeriesGenreStatistics()).data.statistics,
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
                <span>Genres</span>
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
          setAffix(e.currentTarget.scrollTop >= 400);
        }}
      >
        <Row gutter={8}>
          <Col span={18}>
            <Row>
              <Col span={12}>
                <GenreStatisticsChart mediaType={"movies"} stats={movieStats} />
              </Col>
              <Col span={12}>
                <GenreStatisticsChart
                  mediaType={"tv_series"}
                  stats={tvSeriesStats}
                />
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <GenreCountStatisticsChart mediaType={"movies"} />
              </Col>
              <Col span={12}>
                <GenreCountStatisticsChart mediaType={"tv_series"} />
              </Col>
            </Row>
          </Col>
          <Col span={6}>
            <GenreTagCloudChart
              movieStats={movieStats}
              tvSeriesStats={tvSeriesStats}
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

export default GenresIndexPage;
