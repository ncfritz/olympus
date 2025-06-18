"use client";

import { Space, Spin } from "antd";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";

interface ContentDimensionGraphProps {
  loading: boolean;
  data: any;
  title: string;
  height?: number;
}

const ContentDimensionGraph: React.FunctionComponent<
  ContentDimensionGraphProps
> = ({ loading, data, title, height = 250 }: ContentDimensionGraphProps) => {
  let chart = (
    <Space>
      <Spin />
    </Space>
  );

  if (!loading) {
    chart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          colors: ["#003f5c"],
          chart: {
            height: height,
            type: "column",
          },
          plotOptions: {
            series: {
              stacking: "normal",
            },
          },
          title: {
            text: title,
            style: { fontSize: 10 },
          },
          xAxis: {
            categories: data.categories,
            lineWidth: 0,
          },
          yAxis: {
            tickInterval: 50,
          },
          legend: {
            enabled: false,
          },
          series: data.series,
          credits: {
            enabled: false,
          },
        }}
      />
    );
  }

  return chart;
};
export default ContentDimensionGraph;
