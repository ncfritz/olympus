"use client";

import type { GenreStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React, { useEffect, useState } from "react";

export interface GenreStatisticsChartProps {
  mediaType: "tv_series" | "movies";
  stats: GenreStatistic[];
}

const GenreStatisticsChart: React.FunctionComponent<
  GenreStatisticsChartProps
> = ({ mediaType, stats }: GenreStatisticsChartProps) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [data, setData] = useState<number[]>([]);

  useEffect(() => {
    if (stats) {
      const newCategories: string[] = [];
      const newData: number[] = [];

      stats.forEach((value) => {
        newCategories.push(value.genre);
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
          height: 225,
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
          text: mediaType === "movies" ? "Movies Genres" : "TV Series Genres",
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
export default GenreStatisticsChart;
