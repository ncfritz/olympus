import type {
  Goal,
  GoalCycle,
  GoalExecution,
} from "@ncfritz/olympus-sdk/minerva";
import { Col, Row, Statistic, Typography } from "antd";
import React from "react";
import { HEALTH, healthCounts } from "../../../utils/goals";

const { Text } = Typography;

/** The execution score the design aims at. */
export const EXECUTION_TARGET = 85;

const CELL: React.CSSProperties = {
  borderRight: "1px solid #f0f0f0",
  padding: 16,
};

/**
 * Active goals by health, this week's execution and the cycle's week, as
 * a row of statistics in Dionysus's style.
 */
const SummaryStrip: React.FunctionComponent<{
  goals: Goal[];
  execution?: GoalExecution;
  cycle?: GoalCycle;
  loading?: boolean;
}> = ({ goals, execution, cycle, loading }) => {
  const counts = healthCounts(goals);
  return (
    <Row
      style={{
        borderTop: "1px solid #f0f0f0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <Col span={3} style={CELL}>
        <Statistic title={"Active"} value={counts.active} loading={loading} />
      </Col>
      {(["on_track", "at_risk", "off_track"] as const).map((h) => (
        <Col key={h} span={3} style={CELL}>
          <Statistic
            title={HEALTH[h].label}
            value={counts[h]}
            loading={loading}
          />
        </Col>
      ))}
      <Col span={3} style={CELL}>
        <Statistic
          title={"Execution this week"}
          value={execution?.score ?? "–"}
          suffix={execution?.score !== undefined ? "%" : undefined}
          loading={loading}
        />
        {execution && (
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            {execution.done} of {execution.due} · target {EXECUTION_TARGET}%
          </Text>
        )}
      </Col>
      <Col span={3} style={CELL}>
        <Statistic
          title={cycle ? `${cycle.name} · week` : "Cycle"}
          loading={loading}
          value={
            cycle?.currentWeek !== undefined
              ? `${cycle.currentWeek} of ${cycle.weeks}`
              : cycle
                ? cycle.status === "upcoming"
                  ? "Not started"
                  : "Buffer"
                : "None"
          }
        />
      </Col>
    </Row>
  );
};

export default SummaryStrip;
