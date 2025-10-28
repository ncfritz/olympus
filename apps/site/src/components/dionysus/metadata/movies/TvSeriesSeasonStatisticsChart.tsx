"use client";

import type { SeasonStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";

const TvSeriesSeasonStatisticsChart: React.FunctionComponent = () => {
  const [categories, setCategories] = useState<number[]>([]);
  const [data, setData] = useState<number[]>([]);
  const [pointWidth, setPointWidth] = useState(5);

  const [stats, statsLoading, statsError] = useFetch<
    undefined,
    SeasonStatistic[]
  >({
    dataType: "movies",
    watch: [],
    params: undefined,
    fetchFunction: async () =>
      (await metadataApi.getTvSeriesSeasonStatistics()).data.statistics,
  });

  useEffect(() => {
    if (stats) {
      const newCategories: number[] = [];
      const newData: number[] = [];

      stats.forEach((value) => {
        newCategories.push(value.seasons);
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
          text: "Seasons",
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
            name: `Season Count`,
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
export default TvSeriesSeasonStatisticsChart;
