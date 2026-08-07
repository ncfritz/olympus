"use client";

import type { LocationStatistic } from "@ncfritz/olympus-sdk/dionysus";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts/highmaps";
import { useEffect, useState } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";
import topology from "@highcharts/map-collection/custom/world.topo.json" assert { type: "json" };

export interface MovieLocationsMapProps {
  mediaType: "tv_series" | "movies";
}

export const MovieLocationsMap: React.FunctionComponent<
  MovieLocationsMapProps
> = ({ mediaType }: MovieLocationsMapProps) => {
  const [data, setData] = useState<any>([]);
  const [locationStats, locationStatsLoading, locationStatsError] = useFetch<
    undefined,
    LocationStatistic[]
  >({
    dataType: "movie locations",
    watch: [],
    params: undefined,
    fetchFunction: async () => {
      return mediaType === "movies"
        ? (await metadataApi.getMovieLocationStatistics()).data.statistics
        : (await metadataApi.getTvSeriesLocationStatistics()).data.statistics;
    },
  });

  useEffect(() => {
    if (locationStats) {
      const newData = locationStats
        ? locationStats.map((stat) => {
            return [stat.countryCode.toLowerCase(), stat.count];
          })
        : [];

      setData(newData);
    }
  }, [locationStats]);

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType={"mapChart"}
      options={{
        chart: {
          map: topology,
          height: 450,
        },
        mapNavigation: {
          enabled: false,
          enableButtons: false,
        },
        title: {
          text: `Movie Locations`,
          style: { fontSize: 10 },
        },
        xAxis: {
          labels: {
            enabled: false,
          },
        },
        colorAxis: {
          stops: [
            [0.0, "#ffffff"],
            [0.0001, "#fdf9f0"],
            [0.0002, "#fff7e9"],
            [0.0004, "#ffefd5"],
            [0.0008, "#ffe5b5"],
            [0.001, "#fdd588"],
            [0.003, "#fbcb6a"],
            [0.007, "#ffb232"],
            [0.01, "#fdae10"],
            [0.02, "#ffa600"],
            [0.05, "#ff7c43"],
            [0.1, "#f95d6a"],
            [0.2, "#d45087"],
            [0.3, "#a05195"],
            [0.4, "#665191"],
            [0.5, "#2f4b7c"],
            [1.0, "#003f5c"],
          ],
        },
        legend: {
          align: "left",
          x: 20,
        },
        series: [
          {
            mapData: topology,
            data: data,
            dataLabels: {
              enabled: false,
            },
          },
        ],
        credits: {
          enabled: false,
        },
      }}
    />
  );
};
export default MovieLocationsMap;
