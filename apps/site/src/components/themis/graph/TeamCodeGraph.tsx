import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { useEffect } from "react";
import type { CodeMinMaxAvg, CodeStat } from "../../../types/themis";

export interface TeamCodeGraphProps {
  username: string;
  year: string;
  stat: keyof CodeStat;
  userStats: CodeStat[];
  teamStats: CodeMinMaxAvg;
  axisLabel: string;
  max?: number;
  skipSort?: boolean;
}

const TeamCodeGraph: React.FunctionComponent<TeamCodeGraphProps> = ({
  username,
  stat,
  axisLabel,
  max = 10000,
  userStats,
  teamStats,
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

  const series: any[] = [];
  const userData: number[] = [];
  const teamRangeData: number[][] = [];
  const teamAvgData: number[] = [];

  console.log(teamStats);

  userStats.forEach((userStat, index) => {
    userData.push(userStat[stat]);
    teamRangeData.push([
      teamStats.min[index][stat],
      teamStats.max[index][stat],
    ]);
    teamAvgData.push(teamStats.average[index][stat]);
  });

  series.push({ name: username, data: userData, type: "column" });
  series.push({
    name: "Team Avg",
    data: teamAvgData,
    type: "spline",
  });
  series.push({
    name: "Team",
    data: teamRangeData,
    type: "areasplinerange",
    linkedTo: ":previous",
  });

  const options = {
    chart: {
      height: 230,
    },
    plotOptions: {
      areasplinerange: {
        marker: {
          enabled: false,
        },
        lineWidth: 0.5,
        lineColor: "#003f5ccc",
        color: "#003f5c33",
      },
      spline: {
        lineWidth: 1,
        lineColor: "#cc0000",
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
      lineWidth: 1,
      lineColor: "#e6e6e6",
      tickInterval: 1,
      tickColor: "#efefef",
      tickWidth: 1,
      gridLineWidth: 1,
    },
    yAxis: {
      title: {
        text: axisLabel,
      },
      lineWidth: 1,
      lineColor: "#e6e6e6",
      tickInterval: 1,
      min: 0,
      max: max,
    },
    legend: {
      align: "left",
      verticalAlign: "bottom",
      layout: "horizontal",
    },
    tooltip: {
      shared: true,
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

export default TeamCodeGraph;
