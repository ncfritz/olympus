"use client";

import type { MovieStatusStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React, { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";

const MovieReleaseStatusStatisticsChart: React.FunctionComponent = ({}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [data, setData] = useState<number[]>([]);

  const [stats, statsLoading, statsError] = useFetch<
    undefined,
    MovieStatusStatistic[]
  >({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getMovieReleaseStatusStatistics()).data.statistics,
  });

  useEffect(() => {
    if (stats) {
      const newCategories: string[] = [];
      const newData: number[] = [];

      stats.forEach((value) => {
        newCategories.push(value.status);
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
          type: "bar",
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
          text: null,
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
export default MovieReleaseStatusStatisticsChart;
