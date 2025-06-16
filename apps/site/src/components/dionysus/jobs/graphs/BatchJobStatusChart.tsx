import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import React from "react";

export interface BatchJobStatusChartProps {
  jobStats: any;
}

const BatchJobStatusChart = ({ jobStats }: BatchJobStatusChartProps) => {
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
          categories: jobStats.categories.status,
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
            data: jobStats.series.status.cancelled,
            color: "#ffa600",
          },
          {
            name: "Failed",
            data: jobStats.series.status.failed,
            color: "#ff6361",
          },
          {
            name: "Success",
            data: jobStats.series.status.success,
            color: "#bc5090",
          },
          {
            name: "Started",
            data: jobStats.series.status.started,
            color: "#58508d",
          },
          {
            name: "Created",
            data: jobStats.series.status.created,
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
