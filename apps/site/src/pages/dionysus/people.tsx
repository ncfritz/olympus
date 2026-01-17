import { HomeOutlined } from "@ant-design/icons";
import type {
  PersonDepartmentStatistic,
  PersonLifeStatistic,
} from "@ncfritz/olympus-sdk/dionysus";
import { Affix, Col, Layout, Row, Space } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React from "react";
import metadataApi from "../../api/metadataApi";
import LoadingWrapper from "../../components/common/LoadingWrapper";
import PersonDepartmentStatisticsChart from "../../components/dionysus/metadata/people/PersonDepartmentStatisticsChart";
import PersonLifeStatisticsChart from "../../components/dionysus/metadata/people/PersonLifeStatisticsChart";
import PersonList from "../../components/dionysus/metadata/PersonList";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
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
          <Row gutter={16} style={{ margin: 16 }}>
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
          <Space direction={"vertical"} size={2} style={{ width: "100%" }}>
            <PersonList
              title={"Actors"}
              listType={"top actors"}
              initialFilters={{
                type: "in",
                name: "knownForDepartment",
                value: ["Acting", "Actors"],
              }}
              columns={16}
              rows={2}
            />
            <PersonList
              title={"Directors"}
              listType={"top directors"}
              initialFilters={{
                type: "in",
                name: "knownForDepartment",
                value: ["Directing"],
              }}
              columns={16}
            />
            <PersonList
              title={"Creators"}
              listType={"top creators"}
              initialFilters={{
                type: "in",
                name: "knownForDepartment",
                value: ["Creator"],
              }}
              columns={16}
            />
          </Space>
        </Content>
      </Layout>
    </>
  );
};

export default PeopleIndexPage;
