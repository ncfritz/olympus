import { Flex, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import type { CertificateLineage, Renewer } from "@/lib/api/types";
import { RENEWERS } from "@/lib/dashboard";
import {
  expiringByWeek,
  healthCounts,
  issuedByMonth,
  renewerCounts,
} from "@/lib/lineages";
import { CATEGORICAL, HEALTH_COLORS } from "../dashboard/chartColors";
import { baseOptions, useChartTheme } from "../dashboard/chartTheme";
import { GraphBox } from "../dashboard/GraphBox";
import { HealthChart } from "../dashboard/HealthChart";
import styles from "./Certificates.module.css";

/** How many weeks ahead the expiring graph looks: 90 days. */
const WEEKS = 13;

const RENEWER_ORDER: Renewer[] = ["acme", "person", "mtls", "deploy-target"];

/**
 * The Certificates tab's graphs, as boxes in a row: the held certificates
 * by renewal health and by who renews them, what was issued each month,
 * and what expires each week of the next 90 days.
 */
export function LineageGraphs({
  lineages,
  now,
}: {
  lineages: CertificateLineage[];
  now: number;
}) {
  const health = healthCounts(lineages);
  return (
    <div className={styles.graphs}>
      <HealthChart
        health={{
          healthy: health.healthy,
          renewing: health.renewing,
          needsPerson: health["needs-person"],
          failing: health.failing,
        }}
      />
      <Renewers lineages={lineages} />
      <IssuedByMonth lineages={lineages} now={now} />
      <ExpiringByWeek lineages={lineages} now={now} />
    </div>
  );
}

/** The held certificates by who renews them, as a doughnut. */
function Renewers({ lineages }: { lineages: CertificateLineage[] }) {
  const { token, mode } = useChartTheme();
  const slices = useMemo(() => {
    const counts = renewerCounts(lineages);
    return RENEWER_ORDER.map((renewer, i) => ({
      name: RENEWERS[renewer],
      count: counts[renewer],
      color: CATEGORICAL[mode][i],
    }));
  }, [lineages, mode]);
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const options = useMemo((): Highcharts.Options => {
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
        text: `<b>${total}</b><br/>held`,
        verticalAlign: "middle",
        y: 6,
        style: { color: token.colorText, fontSize: "14px" },
      },
      accessibility: {
        description: slices.map((s) => `${s.name}: ${s.count}`).join(", "),
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
          name: "Held certificates",
          data: total
            ? slices.map((s) => ({ name: s.name, y: s.count, color: s.color }))
            : [{ name: "None", y: 1, color: token.colorFillTertiary }],
          enableMouseTracking: total > 0,
        },
      ],
    };
  }, [slices, total, token]);
  return (
    <GraphBox title="Who renews them">
      <Flex gap="middle" align="center" wrap>
        <div className={styles.ring}>
          <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
        <Flex vertical gap={8} className={styles.ringLegend}>
          {slices.map((s) => (
            <Flex key={s.name} align="center" gap="small">
              <svg width={10} height={10} aria-hidden>
                <rect width={10} height={10} rx={2} fill={s.color} />
              </svg>
              <Typography.Text className={styles.grow} ellipsis>
                {s.name}
              </Typography.Text>
              <Typography.Text strong>{s.count}</Typography.Text>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </GraphBox>
  );
}

/** Each of the last 12 months: certificates issued new, and renewals. */
function IssuedByMonth({
  lineages,
  now,
}: {
  lineages: CertificateLineage[];
  now: number;
}) {
  const { token, mode } = useChartTheme();
  const months = useMemo(() => issuedByMonth(lineages, now), [lineages, now]);
  const series = useMemo(
    () =>
      [
        { key: "issued", name: "New", color: CATEGORICAL[mode][1] },
        { key: "renewed", name: "Renewal", color: CATEGORICAL[mode][0] },
      ] as const,
    [mode],
  );
  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 170 },
      accessibility: {
        description: months
          .map((m) => `${m.label}: ${m.issued} new, ${m.renewed} renewals`)
          .join("; "),
      },
      xAxis: {
        ...base.xAxis,
        categories: months.map((m) => m.label),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      yAxis: { ...base.yAxis, reversedStacks: false },
      tooltip: { ...base.tooltip, shared: true },
      plotOptions: {
        column: {
          stacking: "normal",
          borderRadius: 2,
          borderWidth: 1,
          borderColor: token.colorBgContainer,
          animation: false,
          groupPadding: 0.12,
        },
      },
      series: series.map((s) => ({
        type: "column" as const,
        name: s.name,
        color: s.color,
        data: months.map((m) => m[s.key]),
      })),
    };
  }, [months, series, token]);
  return (
    <GraphBox
      title="Issued each month"
      extra={
        <Flex gap="middle" className={styles.legend}>
          {series.map((s) => (
            <span key={s.key} className={styles.legendItem}>
              <svg width={10} height={10} aria-hidden>
                <rect width={10} height={10} rx={2} fill={s.color} />
              </svg>
              {s.name}
            </span>
          ))}
        </Flex>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}

/** Each week of the next 90 days: the held certificates expiring in it. */
function ExpiringByWeek({
  lineages,
  now,
}: {
  lineages: CertificateLineage[];
  now: number;
}) {
  const { token, mode } = useChartTheme();
  const weeks = useMemo(
    () => expiringByWeek(lineages, now, WEEKS),
    [lineages, now],
  );
  const total = weeks.reduce((sum, n) => sum + n, 0);
  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 170 },
      accessibility: {
        description: weeks.map((n, i) => `Week ${i + 1}: ${n}`).join(", "),
      },
      xAxis: {
        ...base.xAxis,
        categories: weeks.map((_, i) =>
          i === 0 ? "Now" : i % 4 === 0 ? `+${i} wk` : "",
        ),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      plotOptions: {
        column: {
          borderRadius: 2,
          borderWidth: 0,
          animation: false,
          groupPadding: 0.08,
        },
      },
      series: [
        {
          type: "column",
          name: "Expiring",
          // This week red; within 30 days, when renewals begin, amber.
          data: weeks.map((n, i) => ({
            y: n,
            color:
              i === 0
                ? HEALTH_COLORS.failing
                : i < 5
                  ? HEALTH_COLORS.needsPerson
                  : CATEGORICAL[mode][0],
          })),
        },
      ],
    };
  }, [weeks, token, mode]);
  return (
    <GraphBox
      title="Expiring, the next 90 days"
      extra={
        <Typography.Text type="secondary" className={styles.small}>
          {total} held
        </Typography.Text>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}
