import { Col, Result, Row, Space, Spin } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { ReviewYearCRResponse } from "../../../pages/api/themis/review/[year]/data/cr";
import type { BasicUserInfo } from "../../../types/themis";
import Badge from "../Badge";
import CRGraph from "../graph/CRGraph";

export interface TeamCRStatisticsPanelProps {
  year: string;
  users: Record<string, BasicUserInfo>;
}

const TeamCRStatisticsPanel = ({ year, users }: TeamCRStatisticsPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [data, setData] = useState<ReviewYearCRResponse | undefined>(undefined);

  useEffect(() => {
    if (year !== undefined) {
      (async () => {
        try {
          setLoading(true);
          setError(false);

          const codeStatsResponse = await themisApi.review.getAllCRStats(
            year as string,
          );
          setData(codeStatsResponse);
        } catch (e) {
          setError(true);
          console.log("Error fetching CR statistics", e);
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
              <CRGraph
                stat={"authored"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
            <Col span={6}>
              <CRGraph
                stat={"received"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
            <Col span={6}>
              <CRGraph
                stat={"commented"}
                data={{ User: value }}
                teamAverage={{ User: data.team.average }}
                inferMax={true}
                limitInferredMax={true}
              />
            </Col>
            <Col span={6}>
              <CRGraph
                stat={"approved"}
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
        <Col span={24}>{userRows}</Col>
      </Row>
    );
  }

  return content;
};
export default TeamCRStatisticsPanel;
