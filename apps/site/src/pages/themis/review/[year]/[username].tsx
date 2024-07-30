import {
  CalendarOutlined,
  HomeOutlined,
  RadarChartOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Col, Layout, Row, Space, Spin } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import themisApi from "../../../../api/themisApi";
import JobHistoryGraph from "../../../../components/themis/graph/JobHistoryGraph";
import CodeSection from "../../../../components/themis/review/CodeSection";
import CRSection from "../../../../components/themis/review/CRSection";
import EmployeeDetailsSection from "../../../../components/themis/review/EmployeeDetailsSection";
import ForteSection from "../../../../components/themis/review/ForteSection";
import NotesSection from "../../../../components/themis/review/NotesSection";
import PerformanceHistorySection from "../../../../components/themis/review/PerformanceHistorySection";
import SectionHeading from "../../../../components/themis/review/SectionHeading";
import type { BasicUserInfo, JobInfo } from "../../../../types/themis";
import type { JobHistoryResponse } from "../../../api/themis/user/[username]/data/[year]/jobHistory";
import type { CodeStatsReviewResponse } from "../../../api/themis/user/[username]/review/[year]/code";
import type { CRStatsReviewResponse } from "../../../api/themis/user/[username]/review/[year]/cr";
import type { ReviewRatingResponse } from "../../../api/themis/user/[username]/review/[year]/rating";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();

  const params = useParams<{ year: string; username: string }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [userInfo, setUserInfo] = useState<BasicUserInfo | undefined>(
    undefined,
  );
  const [userInfoLoading, setUserInfoLoading] = useState<any>();
  const [userInfoError, setUserInfoError] = useState<any>();

  const [jobInfo, setJobInfo] = useState<JobInfo | undefined>(undefined);
  const [jobInfoLoading, setJobInfoLoading] = useState<any>();
  const [jobInfoError, setJobInfoError] = useState<any>();

  const [rating, setRating] = useState<ReviewRatingResponse | undefined>(
    undefined,
  );
  const [ratingLoading, setRatingLoading] = useState<any>();
  const [ratingError, setRatingError] = useState<any>();

  const [jobHistory, setJobHistory] = useState<JobHistoryResponse | undefined>(
    undefined,
  );
  const [jobHistoryLoading, setJobHistoryLoading] = useState<any>();
  const [jobHistoryError, setJobHistoryError] = useState<any>();

  useEffect(() => {
    (async () => {
      if (params.username && params.year) {
        setLoading(true);

        try {
          console.log("Loading...");
          setUserInfo(
            (await themisApi.getBasicUserInfo(params.username)).basicInfo,
          );
          setJobInfo(
            (await themisApi.getJobInfo(params.username, params.year)).jobInfo,
          );
          setRating(
            await themisApi.review.getRating(params.username, params.year),
          );
          setJobHistory(
            await themisApi.getJobHistory(params.username, params.year),
          );
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [params]);

  let content;

  if (!params.username || !params.year || loading) {
    content = (
      <Space style={{ width: "100%", marginTop: 64, justifyContent: "center" }}>
        <Spin size={"large"} />
      </Space>
    );
  } else if (userInfo && jobInfo && jobHistory && rating) {
    content = (
      <>
        <EmployeeDetailsSection
          userInfo={userInfo!}
          jobInfo={jobInfo!}
          year={params.year}
          history={jobHistory}
          rating={rating!.current}
          updateRating={setRating}
        />
        <PerformanceHistorySection reviews={rating?.past} />
        <Row
          style={{
            marginBottom: 16,
          }}
        >
          <Col span={24}>
            <SectionHeading title={"Job History"}>
              <JobHistoryGraph data={jobHistory!.entries} />
            </SectionHeading>
          </Col>
        </Row>
        <NotesSection username={params.username} year={params.year} />
        <ForteSection username={params.username} year={params.year} />
        <CodeSection username={params.username} year={params.year} />
        <CRSection username={params.username} year={params.year} />
      </>
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
              <Link href={`/themis/review/${router.query.year}`}>
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
                <UserAddOutlined />
                <span>Users</span>
              </Space>
            ),
          },
          {
            title: (
              <Space size={4}>
                <UserOutlined />
                <span>{router.query.username}</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 110px)",
          borderRight: "1px solid #e6e6e6",
        }}
      >
        <Content
          style={{
            margin: 0,
            minHeight: 280,
            width: 1224 - 120,
            maxWidth: 1224 - 120,
            padding: 8,
          }}
        >
          {content}
        </Content>
      </Layout>
    </Space>
  );
};

export default IndexPage;
