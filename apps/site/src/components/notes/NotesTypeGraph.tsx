"use client";

import type { GetSummaryResponse } from "@ncfritz/olympus-sdk/minerva";

import { Space, Spin } from "antd";
import { DateTime } from "luxon";
import * as React from "react";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { config } from "../../utils/notes";

interface NotesTypeGraphProps {
  date: DateTime;
  days: number;
  summaryLoading: boolean;
  summary: GetSummaryResponse | undefined;
}

const NotesTypeGraph: React.FunctionComponent<NotesTypeGraphProps> = ({
  date,
  days,
  summaryLoading,
  summary,
}: NotesTypeGraphProps) => {
  const series = [{ name: "Count", data: [0, 0, 0, 0, 0, 0] }];

  let chart = (
    <Space>
      <Spin />
    </Space>
  );

  if (!summaryLoading && summary) {
    for (
      let d = date.minus({ days: days }), i = 0;
      i < days;
      d = d.plus({ days: 1 }), i++
    ) {
      const key = d.toFormat("yyyy-MM-dd");
      const counts = summary.counts;

      [0, 1, 2, 3, 4, 5].forEach((i) => {
        const type = config[i].type;
        series[0].data[i] +=
          key in counts && (counts[key] as Record<string, number>)[type]
            ? (counts[key] as Record<string, number>)[type]
            : 0;
      });
    }

    chart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          colors: ["#32485c"],
          chart: {
            type: "bar",
            height: 200,
            width: 350,
            backgroundColor: "transparent",
          },
          title: {
            text: undefined,
          },
          plotOptions: {
            bar: {
              dataLabels: {
                enabled: false,
              },
              maxPointWidth: 5,
            },
          },
          xAxis: {
            gridLineWidth: 1,
            gridLineDashStyle: "Dot",
            categories: [
              "Note",
              "Idea",
              "Thought",
              "Alert",
              "Praise",
              "Question",
            ],
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
export default NotesTypeGraph;
