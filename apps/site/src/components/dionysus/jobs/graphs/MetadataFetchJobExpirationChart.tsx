"use client";

import type { GetMetadataFetchJobStatusStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export interface MetadataFetchJobExpirationChartProps {
  stats: GetMetadataFetchJobStatusStatisticsResponse;
}

const MetadataFetchJobExpirationChart = ({
  stats,
}: MetadataFetchJobExpirationChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 300,
          type: "column",
        },
        colors: [
          "#003f5c",
          "#19476f",
          "#374c80",
          "#58508d",
          "#7a5195",
          "#9c5196",
          "#bc5090",
          "#d85085",
          "#ef5675",
          "#ff6361",
          "#ff764a",
          "#ff8d2f",
          "#ffa600",
        ],
        xAxis: {
          lineWidth: 0,
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          series: {
            stacking: "normal",
          },
          column: {
            colors: [
              "#003f5c",
              "#19476f",
              "#374c80",
              "#58508d",
              "#7a5195",
              "#9c5196",
              "#bc5090",
              "#d85085",
              "#ef5675",
              "#ff6361",
              "#ff764a",
              "#ff8d2f",
              "#ffa600",
            ],
          },
        },
        title: {
          text: "Expiration Distribution (Weeks)",
          style: { fontSize: 10 },
        },
        legend: {
          layout: "vertical",
          align: "right",
          verticalAlign: "top",
        },
        series: stats.expiration.series,
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default MetadataFetchJobExpirationChart;
