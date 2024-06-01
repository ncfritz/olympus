import { Space, Spin } from "antd";
import { DateTime } from "luxon";
import * as React from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { config } from "../../utils/notes";

interface MonthGraphProps {
  date: DateTime;
  days: number;
  summaryLoading: boolean;
  summary: any;
}

const MonthGraph: React.FunctionComponent<MonthGraphProps> = ({
  date,
  days,
  summary,
  summaryLoading,
}: MonthGraphProps) => {
  const series = [0, 1, 2, 3, 4, 5].map((i) => {
    return { name: config[i].label, data: [] as number[] };
  });

  let chart = (
    <Space>
      <Spin />
    </Space>
  );

  if (!summaryLoading && summary) {
    const xCategories: string[] = [];
    const counts = summary.counts;

    for (
      let d = date.minus({ days: days }), i = 0;
      i < days;
      d = d.plus({ days: 1 }), i++
    ) {
      const key = d.toFormat("yyyy-MM-dd");

      xCategories.push(d.toFormat("MM-dd"));

      [0, 1, 2, 3, 4, 5].forEach((i) => {
        const type = config[i].type;
        series[i].data.push(
          key in counts && counts[key][type] ? counts[key][type] : 0,
        );
      });
    }

    chart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          colors: [
            "#32485c",
            "#67598c",
            "#c05a91",
            "#df5b84",
            "#ff7356",
            "#ffa600",
          ],
          chart: {
            type: "column",
            height: 200,
          },
          title: {
            text: undefined,
          },
          plotOptions: {
            column: {
              stacking: "normal",
              dataLabels: {
                enabled: false,
              },
              maxPointWidth: 10,
            },
          },
          xAxis: {
            categories: xCategories,
            gridLineWidth: 1,
            gridLineDashStyle: "Dot",
            lineWidth: 0,
          },
          yAxis: {
            min: 0,
            gridLineDashStyle: "Dot",
            title: {
              text: false,
            },
            softMax: 5,
            allowDecimals: false,
          },
          legend: {
            align: "right",
            symbolRadius: 2,
            itemStyle: {
              fontWeight: "normal",
              fontSize: "10px",
            },
          },
          tooltip: {
            outside: true,
          },
          series: series,
          credits: {
            enabled: false,
          },
        }}
      />
    );
  }
  return chart;
};
export default MonthGraph;
