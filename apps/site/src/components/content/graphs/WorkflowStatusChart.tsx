"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export type WorkflowStatusChartProps = {
  stats: any;
};

const WorkflowStatusChart = ({ stats }: WorkflowStatusChartProps) => {
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
          series: {
            stacking: "percent",
          },
          column: {
            pointWidth: 15,
          },
        },
        title: {
          text: "Workflow Statuses",
          style: { fontSize: 10 },
        },
        xAxis: {
          type: "datetime",
          labels: {
            format: "{value:%m-%d}",
          },
          lineWidth: 0,
        },
        legend: {
          layout: "horizontal",
          align: "left",
          verticalAlign: "bottom",
        },
        series: [
          {
            name: "Queued",
            data: stats.series.status.queued,
            color: "#003f5c",
          },
          {
            name: "Running",
            data: stats.series.status.running,
            color: "#444e86",
          },
          {
            name: "Success",
            data: stats.series.status.success,
            color: "#dd5182",
          },
          {
            name: "Failed",
            data: stats.series.status.failed,
            color: "#ff6e54",
          },
          {
            name: "Skipped",
            data: stats.series.status.skipped,
            color: "#ffa600",
          },
          {
            name: "Duplicate",
            data: stats.series.status.duplicate,
            color: "#955196",
          },
        ],
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default WorkflowStatusChart;
