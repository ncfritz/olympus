import { Col, Empty, Result, Row, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { CodeStatsReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/code";
import type { CodeStat } from "../../../types/themis";
import CodeGraph from "../graph/CodeGraph";
import TeamCodeGraph from "../graph/TeamCodeGraph";
import SectionHeading from "./SectionHeading";

interface CodeSectionProps {
  username: string;
  year: string;
}

const CodeSection: React.FunctionComponent<CodeSectionProps> = ({
  username,
  year,
}) => {
  const [data, setData] = useState<CodeStatsReviewResponse | undefined>(
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

      const response = await themisApi.review.getCodeStats(username, year);
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
        <CodeSectionRow
          username={username}
          stat={"added"}
          title={"SLOC Added"}
          bottomMargin={32}
          data={data}
        />
        <CodeSectionRow
          username={username}
          stat={"removed"}
          title={"SLOC Removed"}
          bottomMargin={32}
          data={data}
        />
        <CodeSectionRow
          username={username}
          stat={"changes"}
          title={"Changes"}
          bottomMargin={32}
          data={data}
          max={50}
        />
        <CodeSectionRow
          username={username}
          stat={"packages"}
          title={"Packages"}
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
        <SectionHeading title={"Code"}>{content}</SectionHeading>
      </Col>
    </Row>
  );
};

interface CodeSectionRowProps {
  title: string;
  username: string;
  bottomMargin?: number;
  stat: keyof CodeStat;
  data: CodeStatsReviewResponse;
  max?: number;
}
const CodeSectionRow: React.FunctionComponent<CodeSectionRowProps> = ({
  data,
  stat,
  title,
  username,
  bottomMargin = 0,
  max = 10000,
}) => {
  console.log(data);

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
          <CodeGraph
            axisLabel={title}
            data={data.stats}
            stat={stat}
            inferMax={true}
            max={max}
          />
        </Col>
        <Col span={6}>
          <TeamCodeGraph
            year={data.codeYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.codeYear]}
            teamStats={data.peerStats}
            max={max}
          />
        </Col>
        <Col span={6}>
          <TeamCodeGraph
            year={data.codeYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.codeYear]}
            teamStats={data.peersInLevelStats}
            max={max}
          />
        </Col>
      </Row>
    </>
  );
};

export default CodeSection;
