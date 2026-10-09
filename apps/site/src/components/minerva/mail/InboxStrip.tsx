import type { MailInboxSummary } from "@ncfritz/olympus-sdk/minerva";
import { Col, Row, Statistic } from "antd";
import React from "react";

const CELL: React.CSSProperties = {
  borderRight: "1px solid #f0f0f0",
  padding: 16,
};

/** The inbox's counts, in the Re-classification strip's style. */
const InboxStrip: React.FunctionComponent<{
  summary?: MailInboxSummary;
  loading?: boolean;
}> = ({ summary, loading }) => (
  <Row
    style={{
      borderTop: "1px solid #f0f0f0",
      borderBottom: "1px solid #f0f0f0",
    }}
  >
    {(
      [
        ["In inbox", summary?.inInbox],
        ["To review", summary?.toReview],
        ["High confidence (≥ 90%)", summary?.highConfidence],
        ["No suggestion", summary?.noSuggestion],
        ["Approved today", summary?.approved],
      ] as const
    ).map(([title, value]) => (
      <Col key={title} flex={1} style={CELL}>
        <Statistic title={title} value={value} loading={loading} />
      </Col>
    ))}
  </Row>
);

export default InboxStrip;
