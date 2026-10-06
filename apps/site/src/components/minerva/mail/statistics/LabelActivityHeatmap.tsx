"use client";

import type { MailLabelYear } from "@ncfritz/olympus-sdk/minerva";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import "highcharts/modules/heatmap";
import React from "react";
import {
  labelHeatmap,
  labelsByVolume,
  yearSpan,
} from "../../../../utils/mailStatistics";
import { baseChart } from "./charts";

/**
 * Each top label's messages per year as a heatmap, busiest label at the
 * top, each row shaded against that label's own busiest year. A label
 * fading as a similar one rises shows a change in practice.
 */
const LabelActivityHeatmap: React.FunctionComponent<{
  rows: MailLabelYear[];
}> = ({ rows }) => {
  const years = yearSpan(rows);
  const labels = labelsByVolume(rows);
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        ...baseChart(Math.max(200, labels.length * 24 + 80)),
        legend: { enabled: false },
        xAxis: { categories: years.map(String) },
        yAxis: {
          categories: labels,
          reversed: true,
          title: { text: undefined },
        },
        colorAxis: { min: 0, max: 1, minColor: "#ffffff", maxColor: "#32485c" },
        tooltip: {
          formatter: function () {
            const { x, y, count } = (
              this as unknown as {
                point: { x: number; y: number; count: number };
              }
            ).point;
            return `<b>${labels[y]}</b><br/>${years[x]}: ${Highcharts.numberFormat(count, 0)} messages`;
          },
        },
        series: [
          {
            type: "heatmap",
            name: "Messages",
            borderWidth: 1,
            borderColor: "#f0f0f0",
            data: labelHeatmap(rows, labels, years),
          },
        ],
      }}
    />
  );
};

export default LabelActivityHeatmap;
