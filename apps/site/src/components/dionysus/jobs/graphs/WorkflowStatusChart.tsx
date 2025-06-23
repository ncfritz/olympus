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
            color: "#ffa600",
          },
          {
            name: "Started",
            data: stats.series.status.started,
            color: "#ef5675",
          },
          {
            name: "Success",
            data: stats.series.status.success,
            color: "#7a5195",
          },
          {
            name: "Failed",
            data: stats.series.status.failed,
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
export default WorkflowStatusChart;
