"use client";

import type { YearStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";

export interface MovieReleaseYearStatisticsChartProps {
  mediaType: "tv_series" | "movies";
  size?: number;
}

const MovieReleaseYearStatisticsChart: React.FunctionComponent<
  MovieReleaseYearStatisticsChartProps
> = ({ mediaType, size = 10 }: MovieReleaseYearStatisticsChartProps) => {
  const [categories, setCategories] = useState<number[]>([]);
  const [data, setData] = useState<number[]>([]);
  const [pointWidth] = useState(size);

  const [stats] = useFetch<undefined, YearStatistic[]>({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () => {
      return mediaType === "movies"
        ? (await metadataApi.getMovieReleaseYearStatistics()).data.statistics
        : (await metadataApi.getTvSeriesFirstAirYearStatistics()).data
            .statistics;
    },
  });

  useEffect(() => {
    const currentYear = DateTime.utc().year;

    if (stats) {
      const newCategories: number[] = [];
      const newData: number[] = [];

      stats.forEach((value) => {
        if (currentYear - value.year > 50) {
          return;
        }

        newCategories.push(value.year);
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
          height: 275,
          type: "column",
        },
        tooltip: {
          shared: true,
        },
        plotOptions: {
          column: {
            pointWidth: pointWidth,
          },
        },
        title: {
          text:
            mediaType === "movies"
              ? "Releases Distribution"
              : "First Air Distribution",
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
            name: `Release Year`,
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
export default MovieReleaseYearStatisticsChart;
