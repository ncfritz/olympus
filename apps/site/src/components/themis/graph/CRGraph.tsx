import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { useEffect } from "react";
import type { CRStat } from "../../../types/themis";

export interface CRGraphProps {
  axisLabel?: string;
  stat: keyof CRStat;
  data: Record<string, CRStat[]>;
  max?: number;
  inferMax?: boolean;
}

const CodeGraph: React.FunctionComponent<CRGraphProps> = ({
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

  const categories: number[] = Array(53)
    .fill(0)
    .map((element, index) => index);
  const series: any[] = [];

  let localMax = 0;

  Object.keys(data).forEach((year) => {
    const yearData = data[year];
    const parsedData: number[] = [];

    yearData.forEach((entry: CRStat) => {
      if ((entry[stat] as number) > localMax) {
        localMax = entry[stat] as number;
      }

      parsedData.push(entry[stat] as number);
    });

    series.push({ name: year, data: parsedData, type: "column" });
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
        description={"No historic CR statistics available"}
      ></Empty>
    );
  }
};

export default CodeGraph;
