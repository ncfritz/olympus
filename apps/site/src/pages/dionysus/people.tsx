import { HomeOutlined } from "@ant-design/icons";
import type {
  BasePerson,
  PersonDepartmentStatistic,
  PersonLifeStatistic,
} from "@ncfritz/olympus-sdk/dionysus";
import { Affix, Breadcrumb, Col, Layout, Row, Space, Typography } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React from "react";
import metadataApi from "../../api/metadataApi";
import LoadingWrapper from "../../components/common/LoadingWrapper";
import PersonDepartmentStatisticsChart from "../../components/dionysus/metadata/people/PersonDepartmentStatisticsChart";
import PersonLifeStatisticsChart from "../../components/dionysus/metadata/people/PersonLifeStatisticsChart";
import PersonList from "../../components/dionysus/metadata/PersonList";
import { useFetch } from "../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../icons";

const PeopleIndexPage: React.FunctionComponent = () => {
  const [birthdayStats, birthdayStatsLoading, birthdayStatsError] = useFetch<
    undefined,
    PersonLifeStatistic[]
  >({
    dataType: "person birthday",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getPeopleBirthdayStatistics()).data.statistics,
  });

  const [deathdayStats, deathdayStatsLoading, deathdayStatsError] = useFetch<
    undefined,
    PersonLifeStatistic[]
  >({
    dataType: "person deathday",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getPeopleDeathdayStatistics()).data.statistics,
  });

  const [departmentStats, departmentStatsLoading, departmentStatsError] =
    useFetch<undefined, PersonDepartmentStatistic[]>({
      dataType: "person department",
      watch: [],
      params: undefined,
      fetchFunction: async () =>
        (await metadataApi.getPeopleDepartmentStatistics()).data.statistics,
    });

  const [topActors, topActorsLoading, topActorsError] = useFetch<
    undefined,
    BasePerson[]
  >({
    dataType: "top actors",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listPeople(
          1,
          32,
          {
            field: "popularity",
            order: "desc",
          },
          {
            knownForDepartment: ["Acting", "Actors"],
          },
        )
      ).data.people,
  });

  const [topDirectors, topDirectorsLoading, topDirectorsError] = useFetch<
    undefined,
    BasePerson[]
  >({
    dataType: "top actors",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (
        await metadataApi.listPeople(
          1,
          16,
          {
            field: "popularity",
            order: "desc",
          },
          {
            knownForDepartment: ["Directing"],
          },
        )
      ).data.people,
  });

  console.log(topActorsError);

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
                  <span>People</span>
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
          <Row gutter={16}>
            <Col span={8}>
              <LoadingWrapper
                loading={birthdayStatsLoading}
                error={birthdayStatsError}
              >
                <PersonLifeStatisticsChart
                  statisticType={"Birth"}
                  stats={birthdayStats}
                />
              </LoadingWrapper>
            </Col>
            <Col span={8}>
              <LoadingWrapper
                loading={deathdayStatsLoading}
                error={deathdayStatsError}
              >
                <PersonLifeStatisticsChart
                  statisticType={"Death"}
                  stats={deathdayStats}
                />
              </LoadingWrapper>
            </Col>
            <Col span={8}>
              <LoadingWrapper
                loading={deathdayStatsLoading}
                error={deathdayStatsError}
              >
                <PersonDepartmentStatisticsChart stats={departmentStats} />
              </LoadingWrapper>
            </Col>
          </Row>
          <Space
            direction={"vertical"}
            size={16}
            style={{ width: "100%", padding: 16 }}
          >
            <Typography.Title level={4}>
              Most popular actors/actresses...
            </Typography.Title>
            <LoadingWrapper loading={topActorsLoading} error={topActorsError}>
              <PersonList
                people={topActors}
                loading={topActorsLoading}
                columns={16}
              />
            </LoadingWrapper>
            <Typography.Title level={4}>
              Most popular directors...
            </Typography.Title>
            <LoadingWrapper
              loading={topDirectorsLoading}
              error={topDirectorsError}
            >
              <PersonList
                people={topDirectors}
                loading={topDirectorsLoading}
                columns={16}
              />
            </LoadingWrapper>
          </Space>
        </Content>
      </Layout>
    </>
  );
};

export default PeopleIndexPage;
