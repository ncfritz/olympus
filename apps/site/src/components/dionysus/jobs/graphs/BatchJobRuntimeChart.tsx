"use client";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface BatchJobRuntimeChartProps {
  jobStats: any;
}

const BatchJobRuntimeChart = ({ jobStats }: BatchJobRuntimeChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 250,
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
            name: "Movies",
            data: jobStats.series.timing.runtime.movies,
            color: "#003f5c",
          },
          {
            type: "spline",
            name: "TV Series",
            data: jobStats.series.timing.runtime.tv_series,
            color: "#bc5090",
          },
          {
            type: "spline",
            name: "People",
            data: jobStats.series.timing.runtime.people,
            color: "#7a5195",
          },
          {
            type: "spline",
            name: "Collections",
            data: jobStats.series.timing.runtime.collections,
            color: "#bc5090",
          },
          {
            type: "spline",
            name: "TV Networks",
            data: jobStats.series.timing.runtime.tv_networks,
            color: "#ef5675",
          },
          {
            type: "spline",
            name: "Keywords",
            data: jobStats.series.timing.runtime.keywords,
            color: "#ff764a",
          },
          {
            type: "spline",
            name: "Production Companies",
            data: jobStats.series.timing.runtime.production_companies,
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
export default BatchJobRuntimeChart;
