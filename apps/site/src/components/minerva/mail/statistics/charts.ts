import type Highcharts from "highcharts";

/** The series colours the Minerva charts use. */
export const MAIL_CHART_COLORS = [
  "#32485c",
  "#67598c",
  "#c05a91",
  "#df5b84",
  "#ff7356",
  "#ffa600",
];

/** Options every mail chart shares. */
export const baseChart = (height: number): Highcharts.Options => ({
  chart: { height, backgroundColor: "transparent" },
  title: { text: undefined },
  credits: { enabled: false },
  accessibility: { enabled: false },
  colors: MAIL_CHART_COLORS,
});
