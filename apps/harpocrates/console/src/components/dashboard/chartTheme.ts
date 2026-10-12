import { useThemeMode } from "@ncfritz/olympus-console";
import { theme } from "antd";
import type Highcharts from "highcharts";

/** The theme a chart draws in: antd's tokens, and light or dark. */
export const useChartTheme = () => {
  const { token } = theme.useToken();
  const { resolvedMode } = useThemeMode();
  return { token, mode: resolvedMode };
};

/** What every bar and doughnut shares: no title, credits or legend. */
export const baseOptions = (
  token: ReturnType<typeof theme.useToken>["token"],
): Highcharts.Options => ({
  title: { text: undefined },
  credits: { enabled: false },
  legend: { enabled: false },
  chart: {
    backgroundColor: "transparent",
    spacing: [8, 0, 0, 0],
    style: { fontFamily: token.fontFamily },
  },
  tooltip: {
    backgroundColor: token.colorBgElevated,
    borderColor: token.colorBorderSecondary,
    style: { color: token.colorText },
  },
  xAxis: {
    lineColor: token.colorBorderSecondary,
    tickLength: 0,
    labels: { style: { color: token.colorTextSecondary } },
  },
  yAxis: {
    title: { text: undefined },
    allowDecimals: false,
    gridLineColor: token.colorBorderSecondary,
    labels: { style: { color: token.colorTextSecondary } },
  },
});
