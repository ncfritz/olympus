import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { DateTime } from "luxon";
import { useEffect } from "react";
import type { SimMetric, SimStat } from "../../../types/themis";

export interface SimGraphProps {
  axisLabel: string;
  year: string;
  data: SimStat[];
  stat: "created" | "resolved";
  max?: number;
  inferMax?: boolean;
}

const SERIES_LABELS = {
  "1": "Sev1",
  "2": "Sev2",
  "3": "Sev3",
  "4": "Sev4",
  "5": "Sev5",
  "99": "Other",
};

const SimGraph: React.FunctionComponent<SimGraphProps> = ({
  data,
  year,
  axisLabel,
  stat,
  max = 10000,
  inferMax = true,
}) => {
  HC_more(Highcharts);

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
    });
  }, []);

  const categories: number[] = Array(53)
    .fill(0)
    .map((element, index) => index);

  const targetYear = DateTime.fromISO(year);
  const series: any[] = ["1", "2", "3", "4", "5", "99"].map(
    (metric: SimMetric) => {
      return {
        name: SERIES_LABELS[metric],
        type: "column",
        data: [],
      };
    },
  );

  let localMax = 0;

  for (let i = 0; i < targetYear.weeksInWeekYear; i++) {
    ["1", "2", "3", "4", "5", "99"].forEach((metric: SimMetric, index) => {
      series[index].data.push(data[i][stat][metric]);

      if (data[i][stat].total > localMax) {
        localMax = data[i][stat].total;
      }
    });
  }

  const options = {
    chart: {
      height: 230,
    },
    plotOptions: {
      column: {
        pointWidth: 8,
        borderWidth: 0,
        pointPadding: 0,
        stacking: "normal",
      },
      series: {
        animation: false,
      },
    },
    title: {
      text: null,
    },
    colors: ["#d13212", "#ec7211", "#0073bb", "#4b728b", "#545b64", "#aab7b8"],
    xAxis: {
      categories: categories,
      labels: {
        rotation: -45,
      },
      tickInterval: 1,
      lineWidth: 1,
      lineColor: "#e6e6e6",
      tickWidth: 1,
      tickColor: "#e6e6e6",
      gridLineWidth: 1,
    },
    yAxis: {
      title: {
        text: axisLabel,
      },
      lineWidth: 1,
      lineColor: "#e6e6e6",
      tickInterval: 1,
      tickColor: "#e6e6e6",
      min: 0,
      max: inferMax ? localMax : max,
    },
    legend: {
      align: "left",
      verticalAlign: "bottom",
      layout: "horizontal",
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
        description={"No historic SIM data available"}
      ></Empty>
    );
  }
};

export default SimGraph;
