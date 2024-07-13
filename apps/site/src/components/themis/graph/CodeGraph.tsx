import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { DateTime } from "luxon";
import { useEffect } from "react";
import type { CodeStat } from "../../../types/themis";

export interface CodeGraphProps {
  axisLabel?: string;
  stat: keyof CodeStat;
  data: CodeStat[];
  max?: number;
  inferMax?: boolean;
}

const CodeGraph: React.FunctionComponent<CodeGraphProps> = ({
  data,
  stat,
  max = 10000,
  axisLabel,
  inferMax,
}) => {
  HC_more(Highcharts);

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
    });
  }, []);

  const categories: number[] = Array(data.length)
    .fill(0)
    .map((element, index) => index);

  const parsedData: Record<number, number[]> = {};
  let localMax = 0;

  data.forEach((entry: CodeStat) => {
    const entryDate = DateTime.fromISO(entry.date);

    if (!Object.keys(parsedData).includes(entryDate.year.toString())) {
      parsedData[entryDate.year] = [];
    }

    if ((entry[stat] as number) > localMax) {
      localMax = entry[stat] as number;
    }

    parsedData[entryDate.year].push(entry[stat] as number);
  });

  const series = Object.entries(parsedData).map(([key, value]) => {
    return { name: key, data: value, type: "column" };
  });

  const options = {
    chart: {
      height: 230,
    },
    plotOptions: {
      column: {
        pointWidth: 3,
        borderWidth: 0,
        pointPadding: 0,
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
