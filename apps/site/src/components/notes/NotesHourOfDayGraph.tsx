"use client";

import type { GetSummaryResponse } from "@ncfritz/olympus-sdk/minerva";

import { Space, Spin } from "antd";
import { DateTime } from "luxon";
import * as React from "react";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { config } from "../../utils/notes";

interface NotesHourOfDayGraphProps {
  date: DateTime;
  summaryLoading: boolean;
  summary: GetSummaryResponse | undefined;
}

const NotesHourOfDayGraph: React.FunctionComponent<
  NotesHourOfDayGraphProps
> = ({ date, summaryLoading, summary }: NotesHourOfDayGraphProps) => {
  const start = date.startOf("day");
  const end = start.plus({ day: 1 });

  const series = [0, 1, 2, 3, 4, 5].map((i) => {
    return { name: config[i], data: [] as number[] };
  });

  let chart = (
    <Space>
      <Spin />
    </Space>
  );

  if (!summaryLoading && summary) {
    const xCategories: string[] = [];
    const hourCounts = summary.hourly;

    for (let d = start; d < end; d = d.plus({ hour: 1 })) {
      const key = d.toFormat("HH");

      xCategories.push(key);

      [0, 1, 2, 3, 4, 5].forEach((i) => {
        const type = config[i].type;
        series[i].data.push(
          key in hourCounts && (hourCounts[key] as Record<string, number>)[type]
            ? (hourCounts[key] as Record<string, number>)[type]
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
export default NotesHourOfDayGraph;
