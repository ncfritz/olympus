import type { Goal, GoalCheckin } from "@ncfritz/olympus-sdk/minerva";
import { Col, Row, Statistic, Typography } from "antd";
import GoalSection from "./GoalSection";
import Highcharts from "highcharts";
import "highcharts/highcharts-more";
import HighchartsReact from "highcharts-react-official";
import React from "react";
import {
  formatValue,
  outcomeNumbers,
  outcomeSeries,
} from "../../../utils/goals";

const { Text } = Typography;

/**
 * An outcome's numbers (current, where pace says, the projection at the
 * rate so far, the rate needed) and its chart: check-ins, the pace line
 * with its tolerance band, and the projection.
 */
const OutcomePanel: React.FunctionComponent<{
  goal: Goal;
  checkins: GoalCheckin[];
  today: string;
}> = ({ goal, checkins, today }) => {
  const numbers = outcomeNumbers(goal, today);
  const series = outcomeSeries(goal, checkins, today);
  const unit = goal.unit ? ` ${goal.unit}` : "";
  const behind =
    numbers.expected !== undefined
      ? numbers.current - numbers.expected
      : undefined;
  const up = (goal.targetValue ?? 0) >= (goal.startValue ?? 0);

  return (
    <GoalSection title={"Progress against pace"}>
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Statistic
            title={`of ${formatValue(goal.targetValue)}${unit}`}
            value={formatValue(numbers.current)}
          />
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            {formatValue(goal.progress)}% done
          </Text>
        </Col>
        <Col xs={12} lg={6}>
          <Statistic
            title={"Where pace says"}
            value={formatValue(numbers.expected)}
          />
          {behind !== undefined && (
            <Text type={"secondary"} style={{ fontSize: 12 }}>
              {Math.abs(behind) < 0.05
                ? "On pace"
                : `${formatValue(Math.abs(behind))} ${behind > 0 === up ? "ahead" : "behind"}, ${goal.tolerancePct}% band`}
            </Text>
          )}
        </Col>
        <Col xs={12} lg={6}>
          <Statistic
            title={"Projected on the due date"}
            value={formatValue(numbers.projected)}
          />
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            at the rate so far
          </Text>
        </Col>
        <Col xs={12} lg={6}>
          <Statistic
            title={`${unit.trim() || "Change"} a week needed`}
            value={formatValue(numbers.neededPerWeek)}
          />
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            to finish on time
          </Text>
        </Col>
      </Row>
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          chart: { height: 280 },
          title: { text: undefined },
          credits: { enabled: false },
          accessibility: { enabled: false },
          xAxis: { type: "datetime" },
          yAxis: { title: { text: goal.unit ?? undefined } },
          tooltip: { shared: true, xDateFormat: "%b %e, %Y" },
          legend: { align: "left" },
          series: [
            {
              type: "arearange",
              name: "Pace, with tolerance band",
              data: series.band,
              color: "#1677ff",
              fillOpacity: 0.1,
              lineWidth: 0,
              enableMouseTracking: false,
            },
            {
              type: "line",
              name: "Pace",
              data: series.pace,
              color: "#1677ff",
              dashStyle: "Dash",
              marker: { enabled: false },
            },
            {
              type: "line",
              name: "Check-ins",
              data: series.checkins,
              color: "#262626",
              marker: { enabled: true, radius: 3 },
            },
            {
              type: "line",
              name: "Projection",
              data: series.projection,
              color: "#8c8c8c",
              dashStyle: "Dot",
              marker: { enabled: false },
            },
          ],
        }}
      />
    </GoalSection>
  );
};

export default OutcomePanel;
