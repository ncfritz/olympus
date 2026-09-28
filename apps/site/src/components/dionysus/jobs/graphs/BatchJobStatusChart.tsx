"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface BatchJobStatusChartProps {
  stats: any;
}

const BatchJobStatusChart = ({ stats }: BatchJobStatusChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 250,
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
            pointWidth: 15,
          },
        },
        title: {
          text: "Job Statuses",
          style: { fontSize: 10 },
        },
        xAxis: {
          categories: stats.categories.status,
          lineWidth: 0,
        },
        legend: {
          layout: "vertical",
          align: "right",
          verticalAlign: "top",
        },
        series: [
          {
            name: "Cancelled",
            data: stats.series.status.cancelled,
            color: "#ffa600",
          },
          {
            name: "Failed",
            data: stats.series.status.failed,
            color: "#ff6361",
          },
          {
            name: "Success",
            data: stats.series.status.success,
            color: "#bc5090",
          },
          {
            name: "Started",
            data: stats.series.status.started,
            color: "#58508d",
          },
          {
            name: "Created",
            data: stats.series.status.created,
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
export default BatchJobStatusChart;
