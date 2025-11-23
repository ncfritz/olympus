import { HomeOutlined } from "@ant-design/icons";
import type { GenreStatistic } from "@ncfritz/olympus-sdk/dionysus";
import { Affix, Breadcrumb, Col, Layout, Row, Space } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React from "react";
import metadataApi from "../../api/metadataApi";
import GenreCountStatisticsChart from "../../components/dionysus/metadata/movies/GenreCountStatisticsChart";
import GenreStatisticsChart from "../../components/dionysus/metadata/movies/GenreStatisticsChart";
import GenreTagCloudChart from "../../components/dionysus/metadata/movies/GenreTagCloudChart";
import { useFetch } from "../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../icons";

const GenresIndexPage: React.FunctionComponent = () => {
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
                  <span>Genres</span>
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
            <Col span={18}>
              <Row>
                <Col span={12}>
                  <GenreStatisticsChart
                    mediaType={"movies"}
                    stats={movieStats}
                  />
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
        </Content>
      </Layout>
    </>
  );
};

export default GenresIndexPage;
