"use client";

import type { GenreStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import React, { useEffect, useState } from "react";
import "highcharts/modules/wordcloud";

export interface GenreTagCloudChartProps {
  movieStats: GenreStatistic[];
  tvSeriesStats: GenreStatistic[];
}

const GenreTagCloudChart: React.FunctionComponent<GenreTagCloudChartProps> = ({
  movieStats,
  tvSeriesStats,
}: GenreTagCloudChartProps) => {
  const [movieTags, setMovieTags] = useState<any[]>([]);
  const [tvSeriesTags, setTvSeriesTags] = useState<any[]>([]);

  useEffect(() => {
    if (movieStats?.length > 0) {
      setMovieTags(
        movieStats.map((item) => {
          return { name: item.genre, weight: item.count, color: "#003f5c" };
        }),
      );
    }

    if (tvSeriesStats?.length > 0) {
      setTvSeriesTags(
        tvSeriesStats.map((item) => {
          return {
            name: item.genre,
            weight: item.count * 5,
            color: "#bc5090",
          };
        }),
      );
    }
  }, [movieStats, tvSeriesStats]);

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        width: "100%",
        chart: {
          height: 400,
          type: "column",
        },
        tooltip: {
          shared: true,
        },
        title: {
          text: null,
        },
        series: [
          {
            type: "wordcloud",
            data: [...movieTags, ...tvSeriesTags],
            color: "#003f5c",
            placementStrategy: "center",
            maxFontSize: 20,
            minFontSize: 6,
          },
        ],
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default GenreTagCloudChart;
