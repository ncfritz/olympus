"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface SearchExecutionsStatusChartProps {
  stats: {
    new: number[];
    duplicate: number[];
    skipped: number[];
    timing: (number | null)[];
  };
}

const CATEGORIES = ["new", "duplicate", "skipped"];

const SearchExecutionsStatusChart = ({
  stats,
}: SearchExecutionsStatusChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 150,
          type: "column",
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          series: {
            stacking: "normal",
          },
          column: {
            pointWidth: 5,
          },
        },
        title: {
          text: undefined,
        },
        xAxis: {
          categories: CATEGORIES,
          lineWidth: 0,
          labels: {
            enabled: false,
          },
        },
        yAxis: [
          {
            title: {
              enabled: false,
            },
          },
          {
            title: {
              text: "ms",
            },
            min: 0,
          },
        ],
        legend: {
          layout: "horizontal",
          align: "right",
          verticalAlign: "bottom",
        },
        series: [
          {
            name: "New",
            data: stats.new,
            color: "#003f5c",
          },
          {
            name: "Duplicate",
            data: stats.duplicate,
            color: "#bc5090",
          },
          {
            name: "Skipped",
            data: stats.skipped,
            color: "#ffa600",
          },
          {
            name: "Failed",
            // The declared response has no `failed`, so this series has been
            // plotting undefined. Kept rather than deleted: the aggregate
            // statistics endpoint in this same SDK turned out to be declared
            // wrongly, so the absence may be the spec's rather than the API's.
            // docs/roadmap.md asks the question.
            data: (stats as unknown as { failed?: number[] }).failed,
            color: "#ff6361",
          },
          {
            name: "Runtime",
            type: "spline",
            data: stats.timing,
            color: "#003f5c",
            yAxis: 1,
            lineWidth: 1,
            pointWidth: 1,
            marker: {
              symbol: "square",
              radius: 2,
            },
          },
        ],
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default SearchExecutionsStatusChart;
