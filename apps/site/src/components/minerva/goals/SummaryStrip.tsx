import type {
  Goal,
  GoalCycle,
  GoalExecution,
} from "@ncfritz/olympus-sdk/minerva";
import { Card, Col, Progress, Row, Statistic } from "antd";
import React from "react";
import { formatValue, HEALTH, healthCounts } from "../../../utils/goals";

/** The execution score the design aims at. */
export const EXECUTION_TARGET = 85;

/** Active goals by health, this week's execution, and the cycle's week. */
const SummaryStrip: React.FunctionComponent<{
  goals: Goal[];
  execution?: GoalExecution;
  cycle?: GoalCycle;
}> = ({ goals, execution, cycle }) => {
  const counts = healthCounts(goals);
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} lg={4}>
        <Card size={"small"}>
          <Statistic title={"Active"} value={counts.active} />
        </Card>
      </Col>
      {(["on_track", "at_risk", "off_track"] as const).map((h) => (
        <Col key={h} xs={12} lg={4}>
          <Card size={"small"}>
            <Statistic
              title={HEALTH[h].label}
              value={counts[h]}
              styles={{
                content: {
                  color:
                    h === "on_track"
                      ? "#389e0d"
                      : h === "at_risk"
                        ? "#d48806"
                        : "#cf1322",
                },
              }}
            />
          </Card>
        </Col>
      ))}
      <Col xs={12} lg={4}>
        <Card size={"small"}>
          <Statistic
            title={"Execution this week"}
            value={execution?.score ?? "–"}
            suffix={execution?.score !== undefined ? "%" : undefined}
          />
          <Progress
            percent={execution?.score ?? 0}
            showInfo={false}
            size={"small"}
            success={{ percent: 0 }}
            aria-label={`Execution ${formatValue(execution?.score)}% against a target of ${EXECUTION_TARGET}%`}
          />
          {execution && (
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
              {execution.done} of {execution.due} · target {EXECUTION_TARGET}%
            </div>
          )}
        </Card>
      </Col>
      <Col xs={12} lg={4}>
        <Card size={"small"}>
          <Statistic
            title={cycle ? `${cycle.name} · week` : "Cycle"}
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
        </Card>
      </Col>
    </Row>
  );
};

export default SummaryStrip;
