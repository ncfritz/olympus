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
            pointWidth: 10,
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
            name: "Created",
            data: stats.series.status.created,
            color: "#003f5c",
          },
          {
            name: "Started",
            data: stats.series.status.started,
            color: "#58508d",
          },
          {
            name: "Success",
            data: stats.series.status.success,
            color: "#bc5090",
          },
          {
            name: "Failed",
            data: stats.series.status.failed,
            color: "#ff6361",
          },
          {
            name: "Cancelled",
            data: stats.series.status.cancelled,
            color: "#ffa600",
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
