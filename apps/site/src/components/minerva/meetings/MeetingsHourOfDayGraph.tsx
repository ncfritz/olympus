"use client";

import type { GetMeetingStatisticsResponse } from "@ncfritz/olympus-sdk/minerva";

import { Space, Spin } from "antd";
import { DateTime } from "luxon";
import * as React from "react";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { MeetingStatusTypes } from "../../../utils/meetings";

interface MeetingsHourOfDayGraphProps {
  date: DateTime;
  summaryLoading: boolean;
  summary: GetMeetingStatisticsResponse | undefined;
  width?: number;
}

const MeetingsHourOfDayGraph: React.FunctionComponent<
  MeetingsHourOfDayGraphProps
> = ({
  date,
  summaryLoading,
  summary,
  width = 350,
}: MeetingsHourOfDayGraphProps) => {
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
    const xCategories: string[] = [...Array(24)].map((value, index) => {
      return index > 12 ? `${index - 12}PM` : `${index}AM`;
    });
    const hourCounts = summary.hourOfDayStatistics;

    for (let d = start; d < end; d = d.plus({ hour: 1 })) {
      const key = d.toFormat("HH");

      MeetingStatusTypes.forEach((type, count) => {
        series[count].data.push(hourCounts?.[key]?.[type]?.count ?? 0);
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
            width: width,
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
            labels: {
              style: {
                fontSize: 9,
              },
            },
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
