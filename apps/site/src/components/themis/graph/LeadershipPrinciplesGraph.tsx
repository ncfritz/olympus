import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import { Empty } from "antd";
import { type ForteSummary } from "../../../types/themis";

const lpLabels: Record<keyof ForteSummary, string> = {
  customerObsession: "Customer Obsession",
  ownership: "Ownership",
  inventSimplify: "Invent & Simplify",
  areRightALot: "Are Right a lot",
  learnBeCurious: "Learn & Be Curious",
  hireDevelop: "Hire & Develop",
  insistHighestStandards: "Insist on the Highest Standards",
  thinkBig: "Think Big",
  biasForAction: "Bias for Action",
  frugality: "Frugality",
  earnTrust: "Earn Trust",
  diveDeep: "Dive Deep",
  backbone: "Have Backbone",
  deliverResults: "Deliver",
  bestEmployer: "Best Employer",
  successScale: "Success & Scale",
};

export interface LeadershipPrinciplesGraphProps {
  data: Record<string, ForteSummary>;
  type: "strengths" | "opportunities";
}

const LeadershipPrinciplesGraph: React.FunctionComponent<
  LeadershipPrinciplesGraphProps
> = ({ data, type }) => {
  HC_more(Highcharts);
  const series: any[] = [];

  const categories = Object.entries(lpLabels).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ([key, value]) => {
      return value;
    },
  );

  Object.entries(data).forEach(([key, value]) => {
    const seriesData = Object.keys(lpLabels).map((key: keyof ForteSummary) => {
      if (!value[key]) {
        return 0;
      }

      return type === "strengths"
        ? value[key].strength
        : value[key].opportunity;
    });

    series.push({
      name: key,
      data: seriesData,
      pointPlacement: "on",
    });
  });

  const options = {
    chart: {
      polar: true,
      type: "line",
      height: 570,
    },
    plotOptions: {
      series: {
        animation: false,
      },
    },
    title: {
      text: null,
    },
    colors: ["#ffa60066", "#bc509066", "#003f5c"],
    pane: {
      size: "80%",
    },
    xAxis: {
      categories: categories,
      tickmarkPlacement: "on",
      lineWidth: 0,
    },
    yAxis: {
      gridLineInterpolation: "polygon",
      lineWidth: 0,
      min: 0,
      softThreshold: 10,
      tickInterval: 1,
    },
    legend: {
      align: "center",
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
        description={"No LP data available"}
      ></Empty>
    );
  }
};

export default LeadershipPrinciplesGraph;
