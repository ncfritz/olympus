import { useThemeMode } from "@ncfritz/olympus-console";
import { Segmented, theme } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo, useState } from "react";
import type { ActivityDay } from "@/lib/api/types";
import { ACTIVITY_COLORS } from "./chartColors";
import { GraphBox } from "./GraphBox";

const RANGES = [7, 30, 90] as const;

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Certificates issued, renewed and revoked each day, stacked: the last 7,
 * 30 or 90 days. One axis, a legend, a shared tooltip.
 */
export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const { token } = theme.useToken();
  const { resolvedMode } = useThemeMode();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const shown = days.slice(-range);
  const totals = shown.reduce(
    (sum, d) => ({
      issued: sum.issued + d.issued,
      renewed: sum.renewed + d.renewed,
      revoked: sum.revoked + d.revoked,
    }),
    { issued: 0, renewed: 0, revoked: 0 },
  );

  const options: Highcharts.Options = useMemo(() => {
    const colors = ACTIVITY_COLORS[resolvedMode];
    const series = (
      key: keyof typeof totals,
      name: string,
    ): Highcharts.SeriesColumnOptions => ({
      type: "column",
      name: `${name} (${totals[key]})`,
      data: shown.map((d) => d[key]),
      color: colors[key],
    });
    return {
      chart: {
        type: "column",
        height: 200,
        backgroundColor: "transparent",
        spacing: [8, 0, 0, 0],
        style: { fontFamily: token.fontFamily },
      },
      title: { text: undefined },
      credits: { enabled: false },
      accessibility: {
        description: `Certificates over the last ${range} days: ${totals.issued} issued, ${totals.renewed} renewed, ${totals.revoked} revoked`,
      },
      xAxis: {
        categories: shown.map((d) => dayLabel(d.day)),
        lineColor: token.colorBorderSecondary,
        tickLength: 0,
        labels: {
          style: { color: token.colorTextSecondary },
          step: range === 7 ? 1 : range === 30 ? 7 : 14,
        },
      },
      yAxis: {
        title: { text: undefined },
        allowDecimals: false,
        gridLineColor: token.colorBorderSecondary,
        labels: { style: { color: token.colorTextSecondary } },
      },
      legend: {
        align: "left",
        verticalAlign: "top",
        itemStyle: { color: token.colorText, fontWeight: "normal" },
        itemHoverStyle: { color: token.colorText },
      },
      tooltip: {
        shared: true,
        backgroundColor: token.colorBgElevated,
        borderColor: token.colorBorderSecondary,
        style: { color: token.colorText },
      },
      plotOptions: {
        column: {
          stacking: "normal",
          borderWidth: 1,
          borderColor: token.colorBgContainer,
          borderRadius: 2,
          pointPadding: 0.05,
          groupPadding: 0.1,
          animation: false,
        },
      },
      series: [
        series("issued", "Issued"),
        series("renewed", "Renewed"),
        series("revoked", "Revoked"),
      ],
    };
  }, [shown, totals, range, resolvedMode, token]);

  return (
    <GraphBox
      title="Activity"
      extra={
        <Segmented
          size="small"
          value={range}
          onChange={(value) => setRange(value as (typeof RANGES)[number])}
          options={RANGES.map((r) => ({ label: `${r} days`, value: r }))}
        />
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}
