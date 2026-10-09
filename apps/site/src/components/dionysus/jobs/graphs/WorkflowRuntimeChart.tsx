"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import type { GetMetadataWorkflowStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";
import React from "react";

export interface WorkflowJobRuntimeChartProps {
  stats: GetMetadataWorkflowStatisticsResponse;
}

const WorkflowJobRuntimeChart = ({ stats }: WorkflowJobRuntimeChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 200,
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          spline: {
            marker: {
              symbol: "square",
              radius: 2,
            },
            lineWidth: 1,
          },
        },
        title: {
          text: "Runtime",
          style: { fontSize: 10 },
        },
        xAxis: {
          type: "datetime",
          labels: {
            format: "{value:%m-%d}",
          },
          lineWidth: 0,
        },
        yAxis: {
          title: {
            text: "ms",
          },
        },
        legend: {
          align: "left",
        },
        series: [
          {
            type: "spline",
            name: "Runtime",
            data: stats.series.timing.runtime,
            color: "#003f5c",
          },
        ],
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default WorkflowJobRuntimeChart;
