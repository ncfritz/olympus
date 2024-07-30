import type {For} from "@babel/types";
import { Col, Empty, Result, Row, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { ForteSummaryReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/forte";
import LeadershipPrinciplesGraph from "../graph/LeadershipPrinciplesGraph";
import SectionHeading from "./SectionHeading";

export interface ForteSectionProps {
  username: string;
  year: string;
}

const ForteSection: React.FunctionComponent<ForteSectionProps> = ({
  username,
  year,
}: ForteSectionProps) => {
  const [data, setData] = useState<ForteSummaryReviewResponse | undefined>(
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

      const response = await themisApi.review.getForte(username, year);
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
      <Result status={"error"} title={"Unable to load Forte summaries"} />
    );
  } else if (!data) {
    content = <Empty description={"No Forte data found"} />;
  } else {
    content = (
      <>
        <Row>
          <Col span={12} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>Strengths</Typography.Text>
          </Col>
          <Col span={12} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>
              Growth Opportunities
            </Typography.Text>
          </Col>
        </Row>
        <Row>
          <Col span={12}>
            <LeadershipPrinciplesGraph data={data.years} type={"strengths"} />
          </Col>
          <Col span={12}>
            <LeadershipPrinciplesGraph
              data={data.years}
              type={"opportunities"}
            />
          </Col>
        </Row>
      </>
    );
  }

  return (
    <Row>
      <Col span={24} className={"break"}>
        <SectionHeading title={"Forte"}>{content}</SectionHeading>
      </Col>
    </Row>
  );
};
export default ForteSection;
