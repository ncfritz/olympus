import {
  BarChartOutlined,
  CalendarOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Layout, Result, Space, Spin, Tabs } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import themisApi from "../../../../api/themisApi";
import TeamCodeStatisticsPanel from "../../../../components/themis/data/TeamCodeStatisticsPanel";
import TeamCRStatisticsPanel from "../../../../components/themis/data/TeamCRStatisticsPanel";
import type { BasicUserInfo } from "../../../../types/themis";
import type { UsersSummaryResponse } from "../../../api/themis/review/[year]/usersSummary";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { year } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [users, setUsers] = useState<Record<string, BasicUserInfo>>({});

  useEffect(() => {
    if (year !== undefined) {
      (async () => {
        try {
          setLoading(true);
          setError(false);

          const usersResponse: UsersSummaryResponse =
            await themisApi.review.getUsersSummary(year as string);
          const usersMap: Record<string, BasicUserInfo> = {};

          usersResponse.users.forEach((user) => {
            usersMap[user.basicInfo.username] = user.basicInfo;
          });

          setUsers(usersMap);
        } catch (e) {
          setError(true);
          console.log("Error fetching user list", e);
        } finally {
          setLoading(false);
        }

        console.log(users);
      })();
    }
  }, [year]);

  let content;

  if (loading || !year || !users) {
    content = <Spin size={"large"} style={{ marginTop: 32 }} />;
  } else if (error) {
    content = <Result title={"There was an error"} />;
  } else {
    content = (
      <Tabs
        size={"small"}
        tabPosition={"top"}
        items={[
          {
            key: "review-year-code",
            label: "Code",
            children: (
              <TeamCodeStatisticsPanel year={year as string} users={users} />
            ),
          },
          {
            key: "review-year-cr",
            label: "Code Reviews",
            children: (
              <TeamCRStatisticsPanel year={year as string} users={users} />
            ),
          },
        ]}
      />
    );
  }

  return (
    <Space>
      <Breadcrumb
        style={{
          padding: 8,
          background: "#f6f6f6",
          position: "fixed",
          top: 64,
          width: "100%",
          zIndex: 1000,
        }}
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
              <Link href={"/themis"}>
                <Space size={4}>
                  <RadarChartOutlined />
                  <span>Themis</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/themis/reviewYears"}>
                <Space size={4}>
                  <CalendarOutlined />
                  <span>Review Years</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={`/themis/reviews/${year}`}>
                <Space size={4}>
                  <CalendarOutlined />
                  <span>{router.query.year}</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <BarChartOutlined />
                <span>Data</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          margin: 8,
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 110px)",
        }}
      >
        <Content
          style={{
            margin: 0,
            minHeight: 280,
            width: "100%",
          }}
        >
          {content}
        </Content>
      </Layout>
    </Space>
  );
};

export default IndexPage;
