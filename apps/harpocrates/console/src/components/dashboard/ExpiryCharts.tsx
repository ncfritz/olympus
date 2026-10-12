import { useThemeMode } from "@ncfritz/olympus-console";
import { Flex, theme, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import type { DashboardCertificate, Issuer } from "@/lib/api/types";
import { shortCaName } from "@/lib/tree";
import { CATEGORICAL, HEALTH_COLORS } from "./chartColors";
import styles from "./Dashboard.module.css";
import { GraphBox } from "./GraphBox";

const DAY = 24 * 60 * 60 * 1000;

/** The buckets of time to expiry, the expired (in the last 90 days) first. */
const BUCKETS: { label: string; within: (days: number) => boolean }[] = [
  { label: "Expired", within: (d) => d <= 0 && d > -90 },
  { label: "≤ 10 d", within: (d) => d > 0 && d <= 10 },
  { label: "11–30 d", within: (d) => d > 10 && d <= 30 },
  { label: "31–90 d", within: (d) => d > 30 && d <= 90 },
  { label: "> 90 d", within: (d) => d > 90 },
];

/** The most profiles the doughnut names before the rest are "Other". */
const MAX_SLICES = 5;

const useChartTheme = () => {
  const { token } = theme.useToken();
  const { resolvedMode } = useThemeMode();
  return { token, mode: resolvedMode };
};

const baseOptions = (
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

/**
 * The Expirations tab's graphs, as boxes in a row: how long the
 * certificates have left, how many each CA issued, and what expired by
 * profile.
 */
export function ExpiryCharts({
  certificates,
  issuers,
  now,
}: {
  certificates: DashboardCertificate[];
  issuers: Issuer[];
  now: number;
}) {
  const { token, mode } = useChartTheme();

  const buckets = useMemo(
    () =>
      BUCKETS.map(({ label, within }) => ({
        label,
        count: certificates.filter((c) =>
          within((Date.parse(c.notAfter) - now) / DAY),
        ).length,
      })),
    [certificates, now],
  );
  const byCa = useMemo(() => {
    const names = new Map(issuers.map((i) => [i.id, shortCaName(i)]));
    const counts = new Map<string, number>();
    for (const c of certificates.filter((c) => c.health !== "expired")) {
      counts.set(c.issuerId, (counts.get(c.issuerId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ name: names.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count);
  }, [certificates, issuers]);
  const expired = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of certificates.filter((c) => c.health === "expired")) {
      const key = c.profileId ?? "No profile";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const named = sorted.slice(0, MAX_SLICES);
    const rest = sorted.slice(MAX_SLICES).reduce((sum, [, n]) => sum + n, 0);
    return [
      ...named.map(([name, count], i) => ({
        name,
        count,
        color: CATEGORICAL[mode][i],
      })),
      ...(rest
        ? [{ name: "Other", count: rest, color: token.colorTextQuaternary }]
        : []),
    ];
  }, [certificates, mode, token.colorTextQuaternary]);
  const expiredTotal = expired.reduce((sum, e) => sum + e.count, 0);

  const whenOptions = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 200 },
      accessibility: {
        description: buckets.map((b) => `${b.label}: ${b.count}`).join(", "),
      },
      xAxis: {
        ...base.xAxis,
        categories: buckets.map((b) => b.label),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      plotOptions: {
        column: {
          borderRadius: 4,
          borderWidth: 0,
          animation: false,
          dataLabels: {
            enabled: true,
            style: { color: token.colorText, textOutline: "none" },
          },
        },
      },
      series: [
        {
          type: "column",
          name: "Certificates",
          data: buckets.map((b, i) => ({
            y: b.count,
            color: i === 0 ? HEALTH_COLORS.failing : CATEGORICAL[mode][0],
          })),
        },
      ],
    };
  }, [buckets, token, mode]);

  const caOptions = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: {
        ...base.chart,
        type: "bar",
        height: Math.max(120, byCa.length * 34 + 30),
      },
      accessibility: {
        description: byCa.map((c) => `${c.name}: ${c.count}`).join(", "),
      },
      xAxis: {
        ...base.xAxis,
        categories: byCa.map((c) => c.name),
        labels: {
          style: {
            color: token.colorTextSecondary,
            textOverflow: "none",
            width: 150,
          },
        },
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderWidth: 0,
          animation: false,
          color: CATEGORICAL[mode][0],
          dataLabels: {
            enabled: true,
            style: { color: token.colorText, textOutline: "none" },
          },
        },
      },
      series: [{ type: "bar", name: "Valid", data: byCa.map((c) => c.count) }],
    };
  }, [byCa, token, mode]);

  const expiredOptions = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: {
        ...base.chart,
        type: "pie",
        width: 140,
        height: 140,
        margin: 0,
        spacing: [0, 0, 0, 0],
      },
      title: {
        text: `<b>${expiredTotal}</b><br/>expired`,
        verticalAlign: "middle",
        y: 6,
        style: { color: token.colorText, fontSize: "14px" },
      },
      accessibility: {
        description: expired.map((e) => `${e.name}: ${e.count}`).join(", "),
      },
      tooltip: {
        ...base.tooltip,
        headerFormat: "",
        pointFormat: "{point.name}: <b>{point.y}</b>",
      },
      plotOptions: {
        pie: {
          innerSize: "70%",
          dataLabels: { enabled: false },
          borderWidth: 2,
          borderColor: token.colorBgContainer,
          animation: false,
        },
      },
      series: [
        {
          type: "pie",
          name: "Expired",
          data: expiredTotal
            ? expired.map((e) => ({ name: e.name, y: e.count, color: e.color }))
            : [{ name: "None", y: 1, color: token.colorFillTertiary }],
          enableMouseTracking: expiredTotal > 0,
        },
      ],
    };
  }, [expired, expiredTotal, token]);

  return (
    <div className={styles.tabGraphs}>
      <GraphBox title="When they expire">
        <HighchartsReact highcharts={Highcharts} options={whenOptions} />
      </GraphBox>
      <GraphBox title="By issuing CA">
        <HighchartsReact highcharts={Highcharts} options={caOptions} />
      </GraphBox>
      <GraphBox title="Expired, by profile">
        <Flex gap="middle" align="center">
          <div className={styles.ring}>
            <HighchartsReact highcharts={Highcharts} options={expiredOptions} />
          </div>
          <Flex vertical gap={10} className={styles.legend}>
            {expired.length === 0 ? (
              <Typography.Text type="secondary">
                Nothing expired in the last year without being replaced.
              </Typography.Text>
            ) : (
              expired.map((e) => (
                <Flex key={e.name} align="center" gap="small">
                  <svg width={10} height={10} aria-hidden>
                    <rect width={10} height={10} rx={2} fill={e.color} />
                  </svg>
                  <Typography.Text
                    className={styles.grow}
                    ellipsis={{ tooltip: e.name }}
                  >
                    {e.name}
                  </Typography.Text>
                  <Typography.Text strong className={styles.count}>
                    {e.count}
                  </Typography.Text>
                </Flex>
              ))
            )}
          </Flex>
        </Flex>
      </GraphBox>
    </div>
  );
}
