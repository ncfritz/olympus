import { Col, Empty, Result, Row, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { CRStatsReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/cr";
import type { CRStat } from "../../../types/themis";
import CRGraph from "../graph/CRGraph";
import TeamCRGraph from "../graph/TeamCRGraph";
import SectionHeading from "./SectionHeading";

interface CRSectionProps {
  username: string;
  year: string;
}

const CRSection: React.FunctionComponent<CRSectionProps> = ({
  username,
  year,
}) => {
  const [data, setData] = useState<CRStatsReviewResponse | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>();

  const loadCodeStats = async (quite = false) => {
    if (!quite) {
      setLoading(true);
    }

    try {
      setError(undefined);

      const response = await themisApi.review.getCrStats(username, year);
      setData(response);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      loadCodeStats();
    })();
  }, [username, year]);

  let content;

  if (loading) {
    content = (
      <Space
        direction={"vertical"}
        style={{ width: "100%", padding: 64, textAlign: "center" }}
      >
        <Spin size={"large"} />
      </Space>
    );
  } else if (error) {
    content = (
      <Result status={"error"} title={"Unable to load code statistics"} />
    );
  } else if (!data) {
    content = <Empty description={"No code stats found"} />;
  } else {
    content = (
      <>
        <CRSectionRow
          username={username}
          stat={"authored"}
          title={"Authored"}
          bottomMargin={32}
          data={data}
        />
        <CRSectionRow
          username={username}
          stat={"commented"}
          title={"Commented"}
          bottomMargin={32}
          data={data}
        />
        <CRSectionRow
          username={username}
          stat={"received"}
          title={"Received"}
          bottomMargin={32}
          data={data}
          max={50}
        />
        <CRSectionRow
          username={username}
          stat={"approved"}
          title={"Approved"}
          bottomMargin={32}
          data={data}
          max={50}
        />
      </>
    );
  }

  return (
    <Row>
      <Col span={24} className={"break"}>
        <SectionHeading title={"Code Reviews"}>{content}</SectionHeading>
      </Col>
    </Row>
  );
};

interface CRRowProps {
  title: string;
  username: string;
  bottomMargin?: number;
  stat: keyof CRStat;
  data: CRStatsReviewResponse;
  max?: number;
}
const CRSectionRow: React.FunctionComponent<CRRowProps> = ({
  data,
  username,
  stat,
  title,
  bottomMargin = 0,
  max = 80,
}) => {
  return (
    <>
      <Row gutter={16} align={"bottom"} style={{ marginBottom: bottomMargin }}>
        <Col span={12} style={{ display: "flex", justifyContent: "center" }}>
          <Typography.Text style={{ fontSize: 20 }}>{title}</Typography.Text>
        </Col>
        <Col span={6}>
          <Typography.Text
            style={{ display: "flex", justifyContent: "center" }}
          >
            Within Team
          </Typography.Text>
        </Col>
        <Col span={6}>
          <Typography.Text
            style={{ display: "flex", justifyContent: "center" }}
          >
            Within Level
          </Typography.Text>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <CRGraph
            axisLabel={title}
            data={data.stats}
            stat={stat}
            inferMax={true}
          />
        </Col>
        <Col span={6}>
          <TeamCRGraph
            year={data.crYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.crYear]}
            teamStats={data.peerStats}
            max={max}
          />
        </Col>
        <Col span={6}>
          <TeamCRGraph
            year={data.crYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.crYear]}
            teamStats={data.peersInLevelStats}
            max={max}
          />
        </Col>
      </Row>
    </>
  );
};

export default CRSection;
