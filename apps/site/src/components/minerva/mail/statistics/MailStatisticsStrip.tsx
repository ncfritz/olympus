import type { MailStatisticsSummary } from "@ncfritz/olympus-sdk/minerva";
import { Col, Row, Statistic } from "antd";
import React from "react";

const CELL: React.CSSProperties = {
  borderRight: "1px solid #f0f0f0",
  padding: 16,
};

/** Messages, labels in use, senders and unlabelled, in Goals' strip style. */
const MailStatisticsStrip: React.FunctionComponent<{
  summary?: MailStatisticsSummary;
  loading?: boolean;
}> = ({ summary, loading }) => {
  const share =
    summary && summary.messages > 0
      ? (100 * summary.unlabelled) / summary.messages
      : undefined;
  return (
    <Row
      style={{
        borderTop: "1px solid #f0f0f0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <Col span={6} style={CELL}>
        <Statistic
          title={"Messages"}
          value={summary?.messages}
          loading={loading}
        />
      </Col>
      <Col span={6} style={CELL}>
        <Statistic
          title={"Labels in use"}
          value={summary?.labelsInUse}
          loading={loading}
        />
      </Col>
      <Col span={6} style={CELL}>
        <Statistic
          title={"Distinct senders"}
          value={summary?.senders}
          loading={loading}
        />
      </Col>
      <Col span={6} style={{ ...CELL, borderRight: undefined }}>
        <Statistic
          title={"Unlabelled"}
          value={summary?.unlabelled}
          suffix={
            share === undefined ? undefined : (
              <span style={{ fontSize: 14, color: "#8c8c8c" }}>
                {share < 0.1 && share > 0 ? "< 0.1" : share.toFixed(1)}%
              </span>
            )
          }
          loading={loading}
        />
      </Col>
    </Row>
  );
};

export default MailStatisticsStrip;
