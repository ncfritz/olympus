import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { useEffect } from "react";
import type { CodeStat } from "../../../types/themis";

export interface CodeGraphProps {
  axisLabel?: string;
  stat: keyof CodeStat;
  data: Record<string, CodeStat[]>;
  teamAverage?: Record<string, CodeStat[]>;
  max?: number;
  inferMax?: boolean;
  limitInferredMax?: boolean;
  height?: number;
}

const CodeGraph: React.FunctionComponent<CodeGraphProps> = ({
  data,
  teamAverage,
  stat,
  max = 10000,
  axisLabel,
  inferMax,
  limitInferredMax = true,
  height = 230,
}) => {
  HC_more(Highcharts);

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
    });
  }, []);

  const categories: number[] = Array(53)
    .fill(0)
    .map((element, index) => index);
  const series: any[] = [];

  let localMax = 0;
  let inferenceLimitTripped = false;

  Object.keys(data).forEach((year) => {
    const yearData = data[year];
    const parsedData: number[] = [];
    const averageData: number[] = [];

    yearData.forEach((entry) => {
      const value = entry[stat];
      const potentialPoints: number[] = [value];

      if (teamAverage && teamAverage[year]) {
        const teamValue = teamAverage[year][entry.week - 1][stat];
        averageData.push(teamValue);
        potentialPoints.push(teamValue);
      }

      potentialPoints.forEach((point) => {
        if (point > localMax) {
          if (limitInferredMax && point < max) {
            localMax = point;
          } else {
            inferenceLimitTripped = true;
          }
        }
      });

      parsedData.push(value);
    });

    series.push({ name: year, data: parsedData, type: "column" });

    if (teamAverage) {
      series.push({
        name: "Team (avg)",
        data: averageData,
        type: "spline",
        lincColor: "#ffcc33",
      });
    }
  });

  if (inferenceLimitTripped) {
    localMax = max;
  }

  const options = {
    chart: {
      height: height,
    },
    plotOptions: {
      column: {
        pointWidth: 3,
        borderWidth: 0,
        pointPadding: 0,
      },
      spline: {
        lineWidth: 1,
        lineColor: "#cc0000",
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
    xAxis: {
      categories: categories,
      labels: {
        rotation: -45,
      },
      tickInterval: 1,
      lineWidth: 1,
      lineColor: "#e6e6e6",
      tickWidth: 1,
      tickColor: "#e6e6e6",
      gridLineWidth: 1,
    },
    yAxis: {
      title: {
        text: axisLabel,
      },
      lineWidth: 1,
      lineColor: "#e6e6e6",
      tickInterval: 1,
      min: 0,
      max: inferMax ? localMax : max,
    },
    legend: {
      align: "left",
      verticalAlign: "bottom",
      layout: "horizontal",
    },
    tooltip: {
      shared: true,
    },
    credits: {
      enabled: false,
    },
    series: series,
  };

  if (series.length > 0) {
    return <HighchartsReact highcharts={Highcharts} options={options} />;
  } else {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={"No historic code statistics available"}
      ></Empty>
    );
  }
};

export default CodeGraph;
