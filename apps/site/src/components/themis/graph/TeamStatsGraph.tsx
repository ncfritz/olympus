import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { useEffect } from "react";
import type { CodeStatsReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/code";

export interface TeamStatsGraphProps {
  username: string;
  axisLabel: string;
  max?: number;
  skipSort?: boolean;
}

const TeamStatsGraph: React.FunctionComponent<TeamStatsGraphProps> = ({
  username,
  data,
  axisLabel,
  max = 10000,
  skipSort = false,
}) => {
  HC_more(Highcharts);

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
    });
  }, []);

  const categories: any[] = Array(53)
    .fill(0)
    .map((element, index) => index);

  const series: any[] = [];

  if (skipSort) {
    series.push({
      name: username,
      data: data,
      type: "spline",
    });
  } else {
    const sortedUserData = data.stats.sort((a: any, b: any) => {
      return a.year - b.year;
    });

    series.push({
      name: username,
      data: sortedUserData[sortedUserData.length - 1].data,
      type: "spline",
    });
  }

  series.push({ name: "Team", data: teamData, type: "areasplinerange" });

  const options = {
    chart: {
      height: 230,
    },
    plotOptions: {
      areasplinerange: {
        marker: {
          enabled: false,
        },
        color: "#003f5c33",
      },
      series: {
        animation: false,
      },
    },
    title: {
      text: null,
    },
    colors: ["#003f5c"],
    xAxis: {
      categories: categories,
      labels: {
        rotation: -45,
      },
      tickInterval: 1,
      lineWidth: 1,
      tickWidth: 1,
      gridLineWidth: 1,
    },
    yAxis: {
      lineWidth: 1,
      tickInterval: 1,
      min: 0,
      max: max,
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
        description={"No historic data available"}
      ></Empty>
    );
  }
};

export default TeamStatsGraph;
