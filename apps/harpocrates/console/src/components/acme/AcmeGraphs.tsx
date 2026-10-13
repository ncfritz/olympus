import { Flex, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import {
  failureReasons,
  funnelOf,
  ORDER_DAYS,
  perDay,
  TAKEN_BUCKETS,
  timeTaken,
} from "@/lib/acme";
import type { AcmeOrderSummary } from "@/lib/api/types";
import { CATEGORICAL, HEALTH_COLORS } from "../dashboard/chartColors";
import { baseOptions, useChartTheme } from "../dashboard/chartTheme";
import { GraphBox } from "../dashboard/GraphBox";
import styles from "./Acme.module.css";

/**
 * The ACME page's graphs, as boxes in a row: orders each day by outcome,
 * how far the month's orders got, why they failed, and how long issued
 * ones took.
 */
export function AcmeGraphs({
  orders,
  now,
}: {
  orders: AcmeOrderSummary[];
  now: number;
}) {
  return (
    <div className={styles.graphs}>
      <OrdersByDay orders={orders} now={now} />
      <Funnel orders={orders} />
      <Reasons orders={orders} />
      <TimeTaken orders={orders} />
    </div>
  );
}

const Swatch = ({ color, label }: { color: string; label: string }) => (
  <span className={styles.legendItem}>
    <svg width={10} height={10} aria-hidden>
      <rect width={10} height={10} rx={2} fill={color} />
    </svg>
    {label}
  </span>
);

/** Each of the last 30 days: orders issued, failed and in progress. */
function OrdersByDay({
  orders,
  now,
}: {
  orders: AcmeOrderSummary[];
  now: number;
}) {
  const { token, mode } = useChartTheme();
  const days = useMemo(() => perDay(orders, ORDER_DAYS, now), [orders, now]);
  const series = useMemo(
    () =>
      [
        { key: "issued", name: "Issued", color: HEALTH_COLORS.healthy },
        { key: "failed", name: "Failed", color: HEALTH_COLORS.failing },
        {
          key: "pending",
          name: "In progress",
          color: CATEGORICAL[mode][0],
        },
      ] as const,
    [mode],
  );
  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    const label = (day: number) =>
      new Date(day).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 170 },
      accessibility: {
        description: days
          .map(
            (d) =>
              `${label(d.day)}: ${d.issued} issued, ${d.failed} failed, ${d.pending} in progress`,
          )
          .join("; "),
      },
      xAxis: {
        ...base.xAxis,
        categories: days.map((d, i) =>
          i === days.length - 1 ? "Today" : i % 7 === 0 ? label(d.day) : "",
        ),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      yAxis: { ...base.yAxis, reversedStacks: false },
      tooltip: {
        ...base.tooltip,
        shared: true,
        headerFormat: "",
      },
      plotOptions: {
        column: {
          stacking: "normal",
          borderRadius: 2,
          borderWidth: 1,
          borderColor: token.colorBgContainer,
          animation: false,
          groupPadding: 0.08,
        },
      },
      series: series.map((s) => ({
        type: "column" as const,
        name: s.name,
        color: s.color,
        data: days.map((d) => d[s.key]),
      })),
    };
  }, [days, series, token]);
  return (
    <GraphBox
      title="Orders each day"
      extra={
        <Flex gap="middle" className={styles.legend}>
          {series.map((s) => (
            <Swatch key={s.key} color={s.color} label={s.name} />
          ))}
        </Flex>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}

/** Horizontal bars, one to a category: the funnel's and the reasons'. */
const useBars = (
  rows: { name: string; count: number }[],
  color: string,
  description: string,
): Highcharts.Options => {
  const { token } = useChartTheme();
  return useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: {
        ...base.chart,
        type: "bar",
        height: Math.max(90, 34 * rows.length + 30),
      },
      accessibility: {
        description: `${description}: ${rows.map((r) => `${r.name} ${r.count}`).join(", ")}`,
      },
      xAxis: {
        ...base.xAxis,
        categories: rows.map((r) => r.name),
        labels: {
          style: { color: token.colorText, fontSize: "12px" },
        },
      },
      yAxis: { ...base.yAxis, labels: { enabled: false }, gridLineWidth: 0 },
      tooltip: {
        ...base.tooltip,
        headerFormat: "",
        pointFormat: "{point.category}: <b>{point.y}</b>",
      },
      plotOptions: {
        bar: {
          borderRadius: 3,
          borderWidth: 0,
          animation: false,
          groupPadding: 0.1,
          dataLabels: {
            enabled: true,
            style: {
              color: token.colorText,
              textOutline: "none",
              fontWeight: "600",
            },
          },
        },
      },
      series: [
        {
          type: "bar",
          name: description,
          color,
          data: rows.map((r) => r.count),
        },
      ],
    };
  }, [rows, color, description, token]);
};

/** The month's orders, step by step to their certificates. */
function Funnel({ orders }: { orders: AcmeOrderSummary[] }) {
  const { mode } = useChartTheme();
  const steps = useMemo(
    () => funnelOf(orders).map((s) => ({ name: s.step, count: s.count })),
    [orders],
  );
  const options = useBars(
    steps,
    CATEGORICAL[mode][0],
    "From order to certificate",
  );
  const stuck = steps[0].count - steps[steps.length - 1].count;
  return (
    <GraphBox
      title={`From order to certificate, ${ORDER_DAYS} days`}
      extra={
        <Typography.Text type="secondary" className={styles.small}>
          {stuck === 0
            ? "Every order issued"
            : `${stuck} without a certificate`}
        </Typography.Text>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}

/** Why the month's failed orders failed, most often first. */
function Reasons({ orders }: { orders: AcmeOrderSummary[] }) {
  const reasons = useMemo(
    () =>
      failureReasons(orders).map((r) => ({ name: r.reason, count: r.count })),
    [orders],
  );
  const options = useBars(reasons, HEALTH_COLORS.failing, "Why orders failed");
  return (
    <GraphBox title="Why orders failed">
      {reasons.length === 0 ? (
        <Typography.Text type="secondary">
          No order failed in {ORDER_DAYS} days.
        </Typography.Text>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={options} />
      )}
    </GraphBox>
  );
}

/** The month's issued orders by how long they took to their certificate. */
function TimeTaken({ orders }: { orders: AcmeOrderSummary[] }) {
  const { token, mode } = useChartTheme();
  const counts = useMemo(() => timeTaken(orders), [orders]);
  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 170 },
      accessibility: {
        description: TAKEN_BUCKETS.map(
          (b, i) => `${b.label}: ${counts[i]}`,
        ).join(", "),
      },
      xAxis: {
        ...base.xAxis,
        categories: TAKEN_BUCKETS.map((b) => b.label),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      tooltip: {
        ...base.tooltip,
        headerFormat: "",
        pointFormat: "{point.category}: <b>{point.y}</b>",
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
          name: "Orders",
          color: CATEGORICAL[mode][2],
          data: counts,
        },
      ],
    };
  }, [counts, token, mode]);
  const issued = counts.reduce((sum, n) => sum + n, 0);
  return (
    <GraphBox
      title="Order to certificate, time taken"
      extra={
        <Typography.Text type="secondary" className={styles.small}>
          {issued} issued
        </Typography.Text>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}
