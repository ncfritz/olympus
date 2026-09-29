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

/** A genre, weighted by how many titles carry it, for the tag cloud. */
type GenreTag = { name: string; weight: number; color: string };

const GenreTagCloudChart: React.FunctionComponent<GenreTagCloudChartProps> = ({
  movieStats,
  tvSeriesStats,
}: GenreTagCloudChartProps) => {
  const [movieTags, setMovieTags] = useState<GenreTag[]>([]);
  const [tvSeriesTags, setTvSeriesTags] = useState<GenreTag[]>([]);

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
