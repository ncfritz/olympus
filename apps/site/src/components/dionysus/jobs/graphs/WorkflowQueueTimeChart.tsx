"use client";

import type { GetMetadataWorkflowStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface WorkflowQueueTimeChartProps {
  stats: GetMetadataWorkflowStatisticsResponse;
}

const WorkflowQueueTimeChart = ({ stats }: WorkflowQueueTimeChartProps) => {
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
          text: "Queue Latency",
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
            name: "Queue Latency",
            data: stats.series.timing.queueTime,
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
export default WorkflowQueueTimeChart;
