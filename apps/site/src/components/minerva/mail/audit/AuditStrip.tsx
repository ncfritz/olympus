import type { MailAuditSummary } from "@ncfritz/olympus-sdk/minerva";
import { Col, Row, Statistic } from "antd";
import React from "react";
import { percent } from "../../../../utils/mailAudit";

const CELL: React.CSSProperties = {
  borderRight: "1px solid #f0f0f0",
  padding: 16,
};

const SMALL: React.CSSProperties = { fontSize: 14, color: "#8c8c8c" };

/** The latest audit's totals, in Goals' strip style. */
const AuditStrip: React.FunctionComponent<{
  summary?: MailAuditSummary;
  highConfidence: number;
  loading?: boolean;
}> = ({ summary, highConfidence, loading }) => (
  <Row
    style={{
      borderTop: "1px solid #f0f0f0",
      borderBottom: "1px solid #f0f0f0",
    }}
  >
    <Col flex={1} style={CELL}>
      <Statistic
        title={"Proposed changes"}
        value={summary?.changes}
        suffix={
          summary ? (
            <span style={SMALL}>
              {summary.additions.toLocaleString()} in ·{" "}
              {summary.removals.toLocaleString()} out
            </span>
          ) : undefined
        }
        loading={loading}
      />
    </Col>
    <Col flex={1} style={CELL}>
      <Statistic
        title={`High confidence (≥ ${percent(highConfidence)})`}
        value={summary?.highConfidence}
        loading={loading}
      />
    </Col>
    <Col flex={1} style={CELL}>
      <Statistic
        title={"Processed"}
        value={summary?.processed}
        suffix={
          summary && summary.changes > 0 ? (
            <span style={SMALL}>
              {percent(summary.processed / summary.changes)}
            </span>
          ) : undefined
        }
        loading={loading}
      />
    </Col>
    <Col flex={1} style={CELL}>
      <Statistic
        title={"Messages affected"}
        value={summary?.messagesAffected}
        loading={loading}
      />
    </Col>
    <Col flex={1} style={CELL}>
      <Statistic
        title={"Merge candidates"}
        value={summary?.merges}
        loading={loading}
      />
    </Col>
    <Col flex={1} style={{ ...CELL, borderRight: undefined }}>
      <Statistic
        title={"Threads with mixed labels"}
        value={summary?.threads}
        loading={loading}
      />
    </Col>
  </Row>
);

export default AuditStrip;
