"use client";

import type { MovieYearStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";

const MovieReleaseYearStatisticsChart: React.FunctionComponent = () => {
  const [categories, setCategories] = useState<number[]>([]);
  const [data, setData] = useState<number[]>([]);
  const [pointWidth, setPointWidth] = useState(10);

  const [stats, statsLoading, statsError] = useFetch<
    undefined,
    MovieYearStatistic[]
  >({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getMovieReleaseYearStatistics()).data.statistics,
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
          text: `Releases Distribution`,
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
