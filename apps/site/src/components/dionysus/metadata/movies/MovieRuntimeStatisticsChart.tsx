"use client";

import type { RuntimeStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React, { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";

export interface MovieRuntimeStatisticsChartProps {
  mediaType: "tv_series" | "movies";
}

const MovieRuntimeStatisticsChart: React.FunctionComponent<
  MovieRuntimeStatisticsChartProps
> = ({ mediaType }: MovieRuntimeStatisticsChartProps) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [data, setData] = useState<number[]>([]);

  const [stats, statsLoading, statsError] = useFetch<
    undefined,
    RuntimeStatistic[]
  >({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () => {
      return mediaType === "movies"
        ? (await metadataApi.getMovieRuntimeStatistics()).data.statistics
        : (await metadataApi.getTvSeriesEpisodeRuntimeStatistics()).data
            .statistics;
    },
  });

  useEffect(() => {
    if (stats) {
      const newCategories: string[] = [];
      const newData: number[] = [];

      stats.forEach((value) => {
        newCategories.push(value.label);
        newData.push(value.count);
      });

      setCategories(newCategories);
      setData(newData);
    }
  }, [stats]);

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 175,
          type: "column",
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
          text:
            mediaType === "movies"
              ? "Runtime Distribution"
              : "Episode Runtimes",
          style: { fontSize: 10 },
        },
        xAxis: {
          lineWidth: 0,
          categories: categories,
          labels: {
            rotation: -45,
            autoRotation: undefined,
            align: "right",
          },
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
            name: `Runtime`,
            data: data,
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
export default MovieRuntimeStatisticsChart;
