"use client";

import type { GetMetadataFetchJobStatusStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";

import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React from "react";

export type MetadataFetchJobStatusChartProps = {
  stats: GetMetadataFetchJobStatusStatisticsResponse;
};

const MetadataFetchJobStatusChart = ({
  stats,
}: MetadataFetchJobStatusChartProps) => {
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 300,
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
          text: "Job Statuses",
          style: { fontSize: 10 },
        },
        xAxis: {
          categories: [
            "Movies",
            "TV Series",
            "TV Seasons",
            "TV Episodes",
            "People",
            "Collections",
            "TV Networks",
            "Keywords",
            "Production Companies",
            "Certifications",
            "Genres",
            "Countries",
            "Languages",
          ],
          lineWidth: 0,
        },
        legend: {
          layout: "vertical",
          align: "right",
          verticalAlign: "top",
        },
        series: [
          {
            name: "Fetched",
            data: stats.status.series.fetched,
            color: "#003f5c",
          },
          {
            name: "Fetching",
            data: stats.status.series.fetching,
            color: "#374c80",
          },
          {
            name: "Invalidated",
            data: stats.status.series.invalidated,

            color: "#7a5195",
          },
          {
            name: "Failed",
            data: stats.status.series.failed,
            color: "#bc5090",
          },
          {
            name: "Not Found",
            data: stats.status.series.not_found,
            color: "#ef5675",
          },
          {
            name: "Cancelled",
            data: stats.status.series.cancelled,
            color: "#ff764a",
          },
          {
            name: "Queued",
            data: stats.status.series.queued,
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
export default MetadataFetchJobStatusChart;
