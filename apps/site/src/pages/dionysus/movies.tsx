import dynamic from "next/dynamic";
import { HomeOutlined } from "@ant-design/icons";
import type {
  GetMovieAggregateStatisticsResponse,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { Affix, Breadcrumb, Col, Layout, Row, Space, Statistic } from "antd";
import type { FilterValue } from "antd/es/table/interface";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { useState } from "react";
import type { SortOptions } from "../../api/common";
import metadataApi from "../../api/metadataApi";
import MovieList from "../../components/dionysus/metadata/MovieList";
import MovieReleaseStatusStatisticsChart from "../../components/dionysus/metadata/movies/MovieReleaseStatusStatisticsChart";
import MovieReleaseYearStatisticsChart from "../../components/dionysus/metadata/movies/MovieReleaseYearStatisticsChart";
import MovieRuntimeStatisticsChart from "../../components/dionysus/metadata/movies/MovieRuntimeStatisticsChart";
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
  const [filters, setFilters] = useState<
    Record<string, FilterValue> | undefined
  >(undefined);

  const [movies, moviesLoading, moviesError] = useFetch<
    undefined,
    SparseMovie[]
  >({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.listMovies(0, 48, sort, filters)).data.movies,
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
          top: 102,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>
          <Row gutter={8}>
            <Col span={15}>
              <Row>
                <Col span={24}>
                  <MovieReleaseYearStatisticsChart />
                </Col>
              </Row>
              <Row>
                <Col span={12}>
                  <MovieReleaseStatusStatisticsChart />
                </Col>
                <Col span={12}>
                  <MovieRuntimeStatisticsChart />
                </Col>
              </Row>
            </Col>
            <Col span={9}>
              <MovieLocationsMap />
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
                title={"MAx Revenue"}
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
            size={16}
            direction={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            <MovieList movies={movies} loading={moviesLoading} />
          </Space>
        </Content>
      </Layout>
    </>
  );
};

export default MoviesIndexPage;
