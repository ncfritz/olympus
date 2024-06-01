import { Space, Spin } from "antd";
import { DateTime } from "luxon";
import * as React from "react";

import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { MeetingStatusTypes } from "../../../utils/meetings";

interface MeetingsHourOfDayGraphProps {
  date: DateTime;
  summaryLoading: boolean;
  summary: any;
}

const MeetingsHourOfDayGraph: React.FunctionComponent<
  MeetingsHourOfDayGraphProps
> = ({ date, summaryLoading, summary }: MeetingsHourOfDayGraphProps) => {
  const start = date.startOf("day");
  const end = start.plus({ day: 1 });

  const series = MeetingStatusTypes.map((key) => {
    return { name: key, data: [] as number[] };
  });

  let chart = (
    <Space>
      <Spin />
    </Space>
  );

  if (!summaryLoading && summary) {
    const xCategories: string[] = [];
    const hourCounts = summary.hourOfDayStatistics;

    for (let d = start; d < end; d = d.plus({ hour: 1 })) {
      const key = d.toFormat("HH");

      xCategories.push(key);

      MeetingStatusTypes.forEach((type, count) => {
        series[count].data.push(
          key in hourCounts && hourCounts[key][type]
            ? hourCounts[key][type].count
            : 0,
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
            width: 350,
            backgroundColor: "transparent",
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
            gridLineWidth: 1,
            gridLineDashStyle: "Dot",
            categories: xCategories,
            lineWidth: 0,
          },
          yAxis: {
            min: 0,
            gridLineDashStyle: "Dot",
            title: {
              text: "Count",
            },
            softMax: 5,
            allowDecimals: false,
          },
          legend: {
            enabled: false,
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
export default MeetingsHourOfDayGraph;
