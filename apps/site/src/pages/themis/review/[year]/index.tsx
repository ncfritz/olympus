import {
  CalendarOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  HomeOutlined,
  RadarChartOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Affix,
  Avatar,
  Breadcrumb,
  Button,
  Col,
  Layout,
  Result,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import themisApi from "../../../../api/themisApi";
import RatingsGraph from "../../../../components/themis/graph/RatingsGraph";
import Potential from "../../../../components/themis/rating/GrowthPotential";
import Overall from "../../../../components/themis/rating/Overall";
import Performance from "../../../../components/themis/rating/Performance";
import type { ReviewRatingsSummaryResponse } from "../../../api/themis/review/[year]/ratingsSummary";
import type { UserReviewSummary } from "../../../api/themis/review/[year]/usersSummary";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { year } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [users, setUsers] = useState<UserReviewSummary[]>([]);
  const [olrStats, setOlrStats] = useState<any>([]);
  const [ratingSummary, setRatingSummary] =
    useState<ReviewRatingsSummaryResponse>();

  useEffect(() => {
    if (year !== undefined) {
      (async () => {
        try {
          setLoading(true);
          setError(false);

          const usersSummaryResponse = await themisApi.review.getUsersSummary(
            year as string,
          );
          setUsers(usersSummaryResponse.users);

          //const olrStatsResponse = await axios.get(`/api/olr/stats/${year}`);
          setOlrStats(usersSummaryResponse.users);

          const reviewRatingsSummaryResponse =
            await themisApi.review.getRatingsSummary(year as string);
          setRatingSummary(reviewRatingsSummaryResponse);
        } catch (e) {
          setError(true);
          console.log("Error fetching user list", e);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [year]);

  let content;

  if (loading || !year || !olrStats) {
    content = <Spin size={"large"} style={{ marginTop: 32 }} />;
  } else if (error) {
    content = <Result title={"There was an error"} />;
  } else {
    content = (
      <Row>
        <Col span={18}>
          <Content
            style={{
              margin: 0,
              minHeight: 280,
              width: 1224 - 120,
              maxWidth: 1224 - 120,
            }}
          >
            <Row>
              <Col span={24}>
                <RatingsGraph data={ratingSummary!} />
              </Col>
            </Row>
            <Row>
              <Col span={6} className={"b-r1 p5"}></Col>
              <Col span={3} className={"b-b1 b-r1 t-c p5"}>
                Review
              </Col>
              <Col span={7} className={"b-b1 b-r1 t-c p5"}>
                Inputs
              </Col>
              <Col span={8} className={"b-b1 t-c p5"}>
                Data
              </Col>
            </Row>
            <Row>
              <Col
                span={6}
                className={"b-b1 b-r1 p5"}
                style={{
                  display: "flex",
                  alignItems: "end",
                  justifyContent: "start",
                }}
              >
                User
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Performance
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Growth
              </Col>
              <Col span={1} className={"vtext b-b1 b-r1 p5"}>
                Overall
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Job Info
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Organization
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Past Performance
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Mentorship
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Current Rating
              </Col>
              <Col span={1} className={"vtext b-b1 p5"}>
                Notes
              </Col>
              <Col span={1} className={"vtext b-b1 b-r1 p5"}>
                <Typography.Text style={{ marginBottom: 5 }}>
                  ⚾
                </Typography.Text>
              </Col>
              <Col span={2} className={"b-b1 b-r1 t-c-b p5"}>
                Forte
              </Col>
              <Col span={2} className={"b-b1 b-r1 t-c-b p5"}>
                Code
              </Col>
              <Col span={2} className={"b-b1 b-r1 t-c-b p5"}>
                CR
              </Col>
              <Col span={2} className={"b-b1 t-c-b p5"}>
                Tickets
              </Col>
            </Row>
            {users?.map((user: UserReviewSummary, i: number) => {
              const borderBottom = i < users?.length - 1 ? "b-b1-d" : "";

              let bbCardIndicator = (
                <StopOutlined style={{ color: "#666666" }} />
              );

              if (user.bbCard) {
                if (user.dataSummary.bbCard) {
                  bbCardIndicator = (
                    <CheckCircleFilled style={{ color: "#056517" }} />
                  );
                } else {
                  bbCardIndicator = (
                    <CloseCircleFilled style={{ color: "#bf1029" }} />
                  );
                }
              }

              const simContent: any[] = [];
              const simYears: Record<string, any> = {};

              user.pastDataSummary.sim.forEach((yr: string) => {
                const year = yr.substring(yr.lastIndexOf("_") + 3, yr.length);
                const type = yr.substring(0, yr.lastIndexOf("_"));

                if (!(year in simYears)) {
                  simYears[year] = { resolved: false, created: false };
                }

                if (type === "resolved") {
                  simYears[year].resolved = true;
                }

                if (type === "created") {
                  simYears[year].created = true;
                }
              });

              for (const key in simYears) {
                const classNames = [];

                if (simYears[key].created) {
                  classNames.push("sim-c-p");
                } else {
                  classNames.push("sim-c-m");
                }

                if (simYears[key].resolved) {
                  classNames.push("sim-r-p");
                } else {
                  classNames.push("sim-r-m");
                }

                simContent.push(
                  <Tag
                    className={classNames.join(" ")}
                    color={"#108ee9"}
                    style={{
                      width: 32,
                      display: "inline-flex",
                      justifyContent: "center",
                      margin: 2,
                    }}
                  >
                    {key}
                  </Tag>,
                );
              }

              return (
                <Row>
                  <Col span={6} className={`p5 b-r1 ${borderBottom}`}>
                    <Space
                      direction={"horizontal"}
                      size={8}
                      onClick={() => {
                        router.push(
                          `/themis/review/${year}/${user.basicInfo.username}`,
                          `/themis/review/${year}/${user.basicInfo.username}`,
                          { shallow: true },
                        );
                      }}
                      style={{ cursor: "pointer", alignItems: "start" }}
                    >
                      <Avatar
                        size={"large"}
                        src={`https://cdn.ncfritz.net/amzn/avatar/${user.basicInfo.username}.jpg`}
                        shape={"square"}
                      />
                      <Space direction={"vertical"} size={4}>
                        <Typography.Title
                          level={5}
                          style={{
                            lineHeight: 0,
                            margin: 0,
                            marginBottom: 8,
                          }}
                        >
                          {user.basicInfo.givenName} {user.basicInfo.surname}
                        </Typography.Title>
                        <Typography.Text style={{ lineHeight: 0, margin: 0 }}>
                          {user.basicInfo.username}
                        </Typography.Text>
                        <Space size={8} direction={"horizontal"}>
                          <Typography.Link
                            style={{ fontSize: 10 }}
                            href={`/themis/user/${user.basicInfo.username}`}
                          >
                            Data entry
                          </Typography.Link>
                        </Space>
                      </Space>
                    </Space>
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    <Performance
                      rating={user.rating.performance}
                      undecoratedText={true}
                    />
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    <Potential
                      rating={user.rating.growth}
                      undecoratedText={true}
                    />
                  </Col>
                  <Col span={1} className={`t-c b-r1 p5 ${borderBottom}`}>
                    <Overall
                      rating={user.rating.overall}
                      undecoratedText={true}
                    />
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    {user.dataSummary.jobInfo ? (
                      <CheckCircleFilled style={{ color: "#056517" }} />
                    ) : (
                      <CloseCircleFilled style={{ color: "#bf1029" }} />
                    )}
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    {user.dataSummary.jobHistory ? (
                      <CheckCircleFilled style={{ color: "#056517" }} />
                    ) : (
                      <CloseCircleFilled style={{ color: "#bf1029" }} />
                    )}
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    {user.dataSummary.performance ? (
                      <CheckCircleFilled style={{ color: "#056517" }} />
                    ) : (
                      <CloseCircleFilled style={{ color: "#bf1029" }} />
                    )}
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    {user.dataSummary.mentorship ? (
                      <CheckCircleFilled style={{ color: "#056517" }} />
                    ) : (
                      <CloseCircleFilled style={{ color: "#bf1029" }} />
                    )}
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    {user.dataSummary.sim ? (
                      <CheckCircleFilled style={{ color: "#056517" }} />
                    ) : (
                      <CloseCircleFilled style={{ color: "#bf1029" }} />
                    )}
                  </Col>
                  <Col span={1} className={`t-c p5 ${borderBottom}`}>
                    {user.dataSummary.notes ? (
                      <CheckCircleFilled style={{ color: "#056517" }} />
                    ) : (
                      <CloseCircleFilled style={{ color: "#bf1029" }} />
                    )}
                  </Col>
                  <Col span={1} className={`t-c p5 b-r1 ${borderBottom}`}>
                    {bbCardIndicator}
                  </Col>
                  <Col span={2} className={`p5 b-r1 ${borderBottom}`}>
                    {user.pastDataSummary.forteHistory.map((yr: string) => (
                      <Tag
                        color={"#108ee9"}
                        style={{
                          width: 32,
                          display: "inline-flex",
                          justifyContent: "center",
                          margin: 3,
                        }}
                      >
                        {yr.substring(2, 4)}
                      </Tag>
                    ))}
                  </Col>
                  <Col span={2} className={`p5 b-r1 ${borderBottom}`}>
                    {user.pastDataSummary.code.map((yr: string) => (
                      <Tag
                        color={"#108ee9"}
                        style={{
                          width: 32,
                          display: "inline-flex",
                          justifyContent: "center",
                          margin: 2,
                        }}
                      >
                        {yr.substring(2, 4)}
                      </Tag>
                    ))}
                  </Col>
                  <Col span={2} className={`p5 b-r1 ${borderBottom}`}>
                    {user.pastDataSummary.cr.map((yr: string) => (
                      <Tag
                        color={"#108ee9"}
                        style={{
                          width: 32,
                          display: "inline-flex",
                          justifyContent: "center",
                          margin: 2,
                        }}
                      >
                        {yr.substring(2, 4)}
                      </Tag>
                    ))}
                  </Col>
                  <Col span={2} className={`p5 ${borderBottom}`}>
                    {simContent}
                  </Col>
                </Row>
              );
            })}
          </Content>
        </Col>
        <Col span={3} className={"actions"}>
          <Affix offsetTop={100}>
            <Button
              size={"large"}
              style={{ width: "100%" }}
              type={"primary"}
              onClick={() => {
                window.print();
              }}
            >
              Print
            </Button>
          </Affix>
        </Col>
      </Row>
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
              <Space size={4}>
                <CalendarOutlined />
                <span>{router.query.year}</span>
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
          marginRight: 788,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 110px)",
        }}
      >
        <Content
          style={{
            margin: 0,
            minHeight: 280,
            width: 1224 - 120,
            maxWidth: 1224 - 120,
          }}
        >
          {content}
        </Content>
      </Layout>
    </Space>
  );
};

export default IndexPage;
