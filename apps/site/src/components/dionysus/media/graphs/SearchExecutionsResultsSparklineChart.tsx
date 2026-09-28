"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface SearchExecutionsResultsSparklineChartProps {
  stats: {
    new: number[];
    duplicate: number[];
    skipped: number[];
  };
}

const SearchExecutionsResultsSparklineChart = ({
  stats,
}: SearchExecutionsResultsSparklineChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: 250,
        chart: {
          height: 64,
          type: "column",
          backgroundColor: null,
        },
        tooltip: {
          shared: true,
        },
        title: {
          text: undefined,
        },
        plotOptions: {
          series: {
            stacking: "normal",
          },
          column: {
            borderWidth: 0,
          },
        },
        xAxis: {
          labels: {
            enabled: false,
          },
          title: {
            text: undefined,
          },
          startOnTick: false,
          endOnTick: false,
          tickPositions: [],
        },
        yAxis: {
          labels: {
            enabled: false,
          },
          title: {
            text: undefined,
          },
          startOnTick: false,
          endOnTick: false,
          tickPositions: [0],
        },
        legend: {
          enabled: false,
        },
        series: [
          {
            name: "New",
            data: stats.new,
            color: "#003f5c",
            pointWidth: 4,
          },
          {
            name: "Duplicate",
            data: stats.duplicate,
            color: "#bc5090",
            pointWidth: 4,
          },
          {
            name: "Skipped",
            data: stats.skipped,
            color: "#ffa600",
            pointWidth: 4,
          },
        ],
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default SearchExecutionsResultsSparklineChart;
