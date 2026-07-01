"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface SearchExecutionsRuntimeSparklineChartProps {
  stats: any;
}

const SearchExecutionsRuntimeSparklineChart = ({
  stats,
}: SearchExecutionsRuntimeSparklineChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: 160,
        chart: {
          height: 64,
          type: "areaspline",
          backgroundColor: null,
        },
        tooltip: {
          shared: true,
        },
        title: {
          text: undefined,
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
            name: "Runtime",
            type: "areaspline",
            data: stats,
            color: "#003f5c",
            fillColor: "#003f5c22",
            lineWidth: 1,
            pointWidth: 1,
            marker: {
              symbol: "square",
              radius: 1,
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
export default SearchExecutionsRuntimeSparklineChart;
