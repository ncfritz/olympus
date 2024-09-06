import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { useEffect } from "react";
import bellcurve from "highcharts/modules/histogram-bellcurve";
import type { ReviewRatingsSummaryResponse } from "../../../pages/api/themis/review/[year]/ratingsSummary";

export interface RatingsGraphProps {
  data: ReviewRatingsSummaryResponse;
  height?: number;
}

const RatingsGraph: React.FunctionComponent<RatingsGraphProps> = ({
  data,
  height = 300,
}) => {
  HC_more(Highcharts);

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
    });
  }, []);

  const categories: any[] = ["LE", "HV1", "HV2", "HV3", "TT"];
  const series: any[] = [
    {
      name: "Bell curve",
      type: "spline",
      xAxis: 1,
      yAxis: 1,
      zIndex: 100,
      data: [0, 0, 5, 35, 25, 15, 20, 0, 0],
    },
  ];
  const distData = [
    data.distribution.LE,
    data.distribution.HV1,
    data.distribution.HV2,
    data.distribution.HV3,
    data.distribution.TT,
  ];

  series.push({
    name: "Ratings Distribution",
    data: distData,
    type: "column",
  });

  const options = {
    chart: {
      height: height,
    },
    plotOptions: {
      column: {
        pointWidth: 75,
        borderWidth: 0,
        pointPadding: 0,
      },
      spline: {
        marker: {
          enabled: false,
        },
      },
      series: {
        animation: false,
      },
    },
    title: {
      text: null,
    },
    colors: ["#003f5c66", "#003f5c"],
    xAxis: [
      {
        categories: categories,
        lineWidth: 1,
        lineColor: "#f6f6f6",
        tickInterval: 1,
        tickWidth: 1,
        tickColor: "#f6f6f6",
        gridLineWidth: 1,
      },
      {
        alignTicks: false,
        opposite: true,
        visible: false,
        labels: {
          enabled: false,
        },
        title: {
          enabled: false,
        },
      },
    ],
    yAxis: [
      {
        lineWidth: 1,
        lineColor: "#f6f6f6",
        tickInterval: 1,
        min: 0,
      },
      {
        opposite: true,
        visible: false,
        labels: {
          enabled: false,
        },
        title: {
          enabled: false,
        },
      },
    ],
    legend: {
      align: "left",
      verticalAlign: "bottom",
      layout: "horizontal",
    },
    credits: {
      enabled: false,
    },
    series: series,
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default RatingsGraph;
