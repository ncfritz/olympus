"use client";

import type { GenreCountStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React, { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";

export interface GenreCountStatisticsChartProps {
  mediaType: "tv_series" | "movies";
}

const GenreCountStatisticsChart: React.FunctionComponent<
  GenreCountStatisticsChartProps
> = ({ mediaType }: GenreCountStatisticsChartProps) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [data, setData] = useState<number[]>([]);

  const [stats] = useFetch<undefined, GenreCountStatistic[]>({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () => {
      return mediaType === "movies"
        ? (await metadataApi.getMovieGenreCountStatistics()).data.statistics
        : (await metadataApi.getTvSeriesGenreCountStatistics()).data.statistics;
    },
  });

  useEffect(() => {
    if (stats) {
      const newCategories: string[] = [];
      const newData: number[] = [];

      stats.forEach((value) => {
        newCategories.push(value.genres.toString());
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
          height: 150,
          type: "column",
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          column: {
            pointWidth: 15,
          },
        },
        title: {
          text:
            mediaType === "movies"
              ? "Movie Genre Combinations"
              : "TV Series Genre Combinations",
          style: { fontSize: 10 },
        },
        xAxis: {
          lineWidth: 0,
          categories: categories,
        },
        yAxis: {
          type: "logarithmic",
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
export default GenreCountStatisticsChart;
