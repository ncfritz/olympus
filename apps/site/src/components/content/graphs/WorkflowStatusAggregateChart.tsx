"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface WorkflowStatusAggregateChartProps {
  stats: any;
}

const WorkflowStatusAggregateChart: React.FunctionComponent<
  WorkflowStatusAggregateChartProps
> = ({ stats }: WorkflowStatusAggregateChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 200,
          type: "bar",
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          column: {
            pointWidth: 5,
          },
        },
        title: {
          text: "Statuses (Aggregate)",
          style: { fontSize: 10 },
        },
        xAxis: {
          lineWidth: 0,
          categories: stats.categories.status,
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
            data: Object.values(stats.series.statusAggregate),
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
export default WorkflowStatusAggregateChart;
