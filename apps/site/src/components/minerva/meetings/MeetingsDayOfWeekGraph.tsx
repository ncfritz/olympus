"use client";

import { Space, Spin } from "antd";
import { DateTime } from "luxon";
import * as React from "react";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { MeetingStatusTypes } from "../../../utils/meetings";

interface MeetingsHourOfDayGraphProps {
  date: DateTime;
  summaryLoading: boolean;
  summary: any;
  width?: number;
}

const LABELS: Record<string, string> = {
  1: "Sunday",
  2: "Monday",
  3: "Tuesday",
  4: "Wednesday",
  5: "Thursday",
  6: "Friday",
  7: "Saturday",
};

const MeetingsDayOfWeekGraph: React.FunctionComponent<
  MeetingsHourOfDayGraphProps
> = ({
  date,
  summaryLoading,
  summary,
  width = 350,
}: MeetingsHourOfDayGraphProps) => {
  const start = date.startOf("week");
  const end = date.endOf("week");

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
    const dayCounts = summary.dayOfWeekStatistics;

    for (let d = start; d < end; d = d.plus({ day: 1 })) {
      const key = d.weekday.toString();

      xCategories.push(LABELS[key]);

      MeetingStatusTypes.forEach((type, count) => {
        series[count].data.push(
          key in dayCounts && dayCounts[key][type]
            ? dayCounts[key][type].count
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
              maxPointWidth: 25,
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
export default MeetingsDayOfWeekGraph;
