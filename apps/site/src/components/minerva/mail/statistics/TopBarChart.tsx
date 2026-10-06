import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import React from "react";
import { baseChart, MAIL_CHART_COLORS } from "./charts";

export interface TopBarChartProps {
  /** The bars' names, busiest first. */
  names: string[];
  /** Messages per name, in the same order. */
  messages: number[];
  /** A line under each name in its tooltip (a sender's address), if any. */
  details?: (string | undefined)[];
  color?: string;
}

/** A horizontal bar per sender or label, busiest at the top. */
const TopBarChart: React.FunctionComponent<TopBarChartProps> = ({
  names,
  messages,
  details,
  color = MAIL_CHART_COLORS[0],
}) => (
  <HighchartsReact
    highcharts={Highcharts}
    options={{
      ...baseChart(Math.max(160, names.length * 26 + 40)),
      legend: { enabled: false },
      xAxis: {
        categories: names,
        labels: { style: { textOverflow: "ellipsis", width: 220 } },
      },
      yAxis: { title: { text: undefined }, allowDecimals: false },
      tooltip: {
        formatter: function () {
          const { index, y } = (
            this as unknown as {
              point: { index: number; y: number };
            }
          ).point;
          const detail = details?.[index];
          return `<b>${names[index]}</b>${
            detail ? `<br/>${detail}` : ""
          }<br/>${Highcharts.numberFormat(y, 0)} messages`;
        },
      },
      plotOptions: {
        // One sender or label often dwarfs the rest; the counts keep the
        // short bars readable.
        bar: {
          dataLabels: {
            enabled: true,
            format: "{point.y:,.0f}",
            style: { fontWeight: "normal", textOutline: "none" },
          },
        },
      },
      series: [{ type: "bar", name: "Messages", data: messages, color }],
    }}
  />
);

export default TopBarChart;
