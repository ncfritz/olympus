import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty, Spin } from "antd";
import { useEffect } from "react";

export interface SparklineGraphProps {
  axisLabel: string;
  data: any[];
  max: number;
}

const SparklineGraph: React.FunctionComponent<SparklineGraphProps> = ({
  data,
  axisLabel,
  max,
}) => {
  HC_more(Highcharts);

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
    });
  }, []);

  const categories: any[] = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const series: any[] = [{ data: data, type: "areaspline" }];

  const options = {
    chart: {
      height: 50,
      borderWidth: 0,
      margin: [8, 0, 0, 0],
      style: {
        overflow: "visible",
      },
    },
    plotOptions: {
      series: {
        animation: false,
        lineWidth: 1,
        fillOpacity: 0.25,
        marker: {
          radius: 1,
          states: {
            hover: {
              radius: 2,
            },
          },
        },
      },
    },
    title: {
      text: null,
    },
    colors: ["#222222"],
    xAxis: {
      labels: {
        enabled: false,
      },
      title: {
        text: null,
      },
      startOnTick: false,
      endOnTick: false,
      tickPositions: [],
    },
    yAxis: {
      startOnTick: false,
      endOnTick: false,
      tickPositions: [],
      min: 0,
      max: max,
    },
    legend: {
      enabled: false,
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
        description={"No historic Forte data available"}
      ></Empty>
    );
  }
};

export default SparklineGraph;
