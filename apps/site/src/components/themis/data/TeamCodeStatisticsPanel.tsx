import { Col, Result, Row, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { ReviewYearCodeResponse } from "../../../pages/api/themis/review/[year]/data/code";
import type { BasicUserInfo } from "../../../types/themis";
import Badge from "../Badge";
import CodeGraph from "../graph/CodeGraph";

export interface TeamCodeStatisticsPanelProps {
  year: string;
  users: Record<string, BasicUserInfo>;
}

const TeamCodeStatisticsPanel = ({
  year,
  users,
}: TeamCodeStatisticsPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [data, setData] = useState<ReviewYearCodeResponse | undefined>(
    undefined,
  );

  useEffect(() => {
    if (year !== undefined) {
      (async () => {
        try {
          setLoading(true);
          setError(false);

          const codeStatsResponse = await themisApi.review.getAllCodeStats(
            year as string,
          );
          setData(codeStatsResponse);
        } catch (e) {
          setError(true);
          console.log("Error fetching code statistics", e);
        } finally {
          setLoading(false);
        }

        console.log(users);
      })();
    }
  }, [year]);

  let content;

  if (loading || !data) {
    content = (
      <Space
        direction={"horizontal"}
        style={{ width: "100%", textAlign: "center", padding: 64 }}
      >
        <Spin size={"large"} />
      </Space>
    );
  } else if (error) {
    content = (
      <Result status={"error"} title={"Unable to load team code statistics"} />
    );
  } else {
    const userRows = Object.entries(data.userStats).map(([key, value]) => {
      const userInfo = users[key];

      return (
        <div style={{ display: "inline-flex", width: "100%", marginBottom: 8 }}>
          <Badge
            username={userInfo.username}
            name={userInfo.givenName}
            tenure={3}
            size={"small"}
          />
          <Row style={{ flexGrow: 1 }}>
            <Col span={6}>
              <CodeGraph
                stat={"added"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
            <Col span={6}>
              <CodeGraph
                stat={"removed"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
            <Col span={6}>
              <CodeGraph
                stat={"changes"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
            <Col span={6}>
              <CodeGraph
                stat={"packages"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
          </Row>
        </div>
      );
    });

    content = (
      <Row>
        <Row style={{ flexGrow: 1, marginLeft: 100 }}>
          <Col span={6} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>SLOC Added</Typography.Text>
          </Col>
          <Col span={6} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>SLOC Removed</Typography.Text>
          </Col>
          <Col span={6} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>Changes</Typography.Text>
          </Col>
          <Col span={6} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>Packages</Typography.Text>
          </Col>
        </Row>
        <Col span={24}>{userRows}</Col>
      </Row>
    );
  }

  return content;
};
export default TeamCodeStatisticsPanel;
