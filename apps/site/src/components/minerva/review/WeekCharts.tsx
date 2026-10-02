import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { Statistic } from "antd";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import React from "react";
import type {
  DayLoad,
  RatingChange,
  RatingSeries,
} from "../../../utils/reviews";
import styles from "./Review.module.css";

const COLORS = ["#262626", "#1677ff", "#fa8c16", "#52c41a"];

const base = (height: number): Highcharts.Options => ({
  chart: { height },
  title: { text: undefined },
  credits: { enabled: false },
  accessibility: { enabled: false },
  legend: { align: "left" },
});

export interface RatingsChartProps {
  days: string[];
  series: RatingSeries[];
  changes: RatingChange[];
}

/**
 * The week's daily ratings a line each, broken where a day has none, and
 * each rating's average against last week's.
 */
export const RatingsChart: React.FunctionComponent<RatingsChartProps> = ({
  days,
  series,
  changes,
}) => (
  <div className={styles.stack}>
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        ...base(220),
        xAxis: { categories: days },
        yAxis: {
          title: { text: undefined },
          min: 0,
          max: 5,
          tickInterval: 1,
        },
        tooltip: { shared: true },
        plotOptions: { line: { connectNulls: false } },
        series: series.map((s, i) => ({
          type: "line",
          name: s.label,
          data: s.data,
          color: COLORS[i % COLORS.length],
          lineWidth: i === 0 ? 3 : 1.5,
          marker: { enabled: true, radius: i === 0 ? 4 : 3 },
        })),
      }}
    />
    <div className={styles.changes}>
      {changes.map((c) => (
        <div key={c.key}>
          <Statistic
            title={`${c.label}, average`}
            value={c.value === undefined ? "–" : c.value.toFixed(1)}
          />
          <span className={styles.meta}>
            {c.change === undefined ? (
              c.previous === undefined ? (
                "nothing last week"
              ) : (
                `${c.previous.toFixed(1)} last week`
              )
            ) : c.change === 0 ? (
              "same as last week"
            ) : (
              <>
                <span className={c.change > 0 ? styles.up : styles.down}>
                  {c.change > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{" "}
                  {Math.abs(c.change).toFixed(1)}
                </span>{" "}
                from {c.previous!.toFixed(1)}
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export interface TimeChartProps {
  days: string[];
  loads: DayLoad[];
}

/** Each day's hours in meetings and in focus blocks, stacked. */
export const TimeChart: React.FunctionComponent<TimeChartProps> = ({
  days,
  loads,
}) => (
  <HighchartsReact
    highcharts={Highcharts}
    options={{
      ...base(220),
      xAxis: { categories: days },
      yAxis: { title: { text: "Hours" }, allowDecimals: false },
      tooltip: { shared: true, valueDecimals: 1, valueSuffix: " h" },
      plotOptions: { column: { stacking: "normal", borderWidth: 0 } },
      series: [
        {
          type: "column",
          name: "Meetings",
          data: loads.map((d) => d.meetingMinutes / 60),
          color: "#4096ff",
        },
        {
          type: "column",
          name: "Focus blocks",
          data: loads.map((d) => d.focusMinutes / 60),
          color: "#95de64",
        },
      ],
    }}
  />
);
