"use client";

import type { GetContentIngestionWorkflowStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface WorkflowSourceAggregateChartProps {
  stats: GetContentIngestionWorkflowStatisticsResponse;
}

const WorkflowSourceAggregateChart: React.FunctionComponent<
  WorkflowSourceAggregateChartProps
> = ({ stats }: WorkflowSourceAggregateChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 200,
          type: "column",
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          column: {
            pointWidth: 25,
          },
        },
        title: {
          text: "Sources (Aggregate)",
          style: { fontSize: 10 },
        },
        xAxis: {
          lineWidth: 0,
          categories: stats.categories.source,
        },
        yAxis: {
          title: {
            text: null,
          },
        },
        legend: {
          enabled: false,
        },
        series: [
          {
            name: null,
            data: Object.values(stats.series.sourceAggregate),
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
export default WorkflowSourceAggregateChart;
