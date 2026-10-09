import type { MailSenderYear } from "@ncfritz/olympus-sdk/minerva";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import React from "react";
import {
  senderSeries,
  withoutZeros,
  yearSpan,
} from "../../../../utils/mailStatistics";
import { baseChart } from "./charts";

/**
 * A line per top sender: its messages each year, on a log axis, since the
 * busiest sender can send a hundred times what the next does.
 */
const SenderActivityChart: React.FunctionComponent<{
  rows: MailSenderYear[];
}> = ({ rows }) => {
  const years = yearSpan(rows);
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={{
        ...baseChart(300),
        legend: { align: "left" },
        xAxis: { categories: years.map(String) },
        yAxis: {
          type: "logarithmic",
          title: { text: "Messages (log scale)" },
          allowDecimals: false,
        },
        tooltip: { shared: true },
        series: senderSeries(rows, years).map((s) => ({
          type: "line",
          name: s.name,
          data: withoutZeros(s.data),
        })),
      }}
    />
  );
};

export default SenderActivityChart;
