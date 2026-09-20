"use client";

import { useMemo, type CSSProperties } from "react";
import { Col, Row, Spin, Typography, theme } from "antd";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import useSWR from "swr";
import {
  fetchSyncRunStats,
  type SyncRunDailyStat,
  type SyncRunFilterParams,
} from "@/lib/api/queries";

const STATS_WINDOW_DAYS = 30;
const CHART_HEIGHT = 225;

/** Shared point/line styling — every series (spline or column) gets a thin line and small circular markers, rather than Highcharts' default of a heavier line and a different marker shape per series. */
const SERIES_PLOT_OPTIONS: Highcharts.PlotSeriesOptions = {
  lineWidth: 1,
  marker: { radius: 3, symbol: "circle" },
};

/** Typography.Text renders inline by default — block is needed for centering to apply. */
const CHART_LABEL_STYLE: CSSProperties = {
  display: "block",
  textAlign: "center",
  marginBottom: 8,
};

const BASE_OPTIONS: Highcharts.Options = {
  credits: { enabled: false },
  title: { text: undefined },
  chart: { height: CHART_HEIGHT },
  legend: { align: "left", verticalAlign: "bottom", layout: "horizontal" },
};

/** The last N UTC calendar days, oldest first, as YYYY-MM-DD — independent of what the backend actually returned, so a day with no runs still renders as a gap/zero instead of being skipped. */
function lastNDays(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - (n - 1 - i),
      ),
    );
    return d.toISOString().slice(0, 10);
  });
}

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface DayTotals {
  successCount: number;
  errorCount: number;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  totalCount: number;
}

function emptyDayTotals(): DayTotals {
  return {
    successCount: 0,
    errorCount: 0,
    addedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    totalCount: 0,
  };
}

/**
 * Three 30-day charts for the Sync page, sharing its filters (calendar,
 * type, trigger, status) and one underlying `/sync-runs/stats` fetch —
 * pivoted client-side into what each chart needs rather than three
 * separate endpoints.
 */
export function SyncStatsCharts({ filter }: { filter: SyncRunFilterParams }) {
  const { token } = theme.useToken();
  // Highcharts has no notion of the app's theme — these are merged into
  // every chart's own options below so axis/legend/tooltip chrome tracks
  // antd's current color tokens instead of Highcharts' light-mode defaults,
  // which otherwise leave a plain white panel behind in dark mode.
  const chartTheme: Highcharts.Options = useMemo(
    () => ({
      // Matches the Sync History table's background rather than the plain
      // page background behind it, so the chart doesn't look like a
      // transparent cutout against a subtly different shade.
      chart: { backgroundColor: token.colorBgContainer },
      xAxis: {
        labels: { style: { color: token.colorTextSecondary } },
        lineColor: token.colorBorderSecondary,
        tickColor: token.colorBorderSecondary,
      },
      yAxis: {
        labels: { style: { color: token.colorTextSecondary } },
        title: { style: { color: token.colorTextSecondary } },
        gridLineColor: token.colorBorderSecondary,
      },
      legend: {
        itemStyle: { color: token.colorText },
        itemHoverStyle: { color: token.colorTextSecondary },
      },
      tooltip: {
        backgroundColor: token.colorBgElevated,
        borderColor: token.colorBorderSecondary,
        style: { color: token.colorText },
      },
    }),
    [token],
  );

  const { data: stats = [], isLoading } = useSWR(
    [
      "/sync-runs/stats",
      filter.calendarId,
      filter.type,
      filter.trigger,
      filter.status,
    ],
    () => fetchSyncRunStats({ ...filter, days: STATS_WINDOW_DAYS }),
  );

  const days = useMemo(() => lastNDays(STATS_WINDOW_DAYS), []);
  const categories = useMemo(() => days.map(formatDayLabel), [days]);

  const calendars = useMemo(() => {
    const bySourceLabel = new Map<string, string>();
    for (const s of stats) bySourceLabel.set(s.calendarId, s.source);
    return [...bySourceLabel.entries()].map(([calendarId, source]) => ({
      calendarId,
      source,
    }));
  }, [stats]);

  const byDayAndCalendar = useMemo(() => {
    const map = new Map<string, SyncRunDailyStat>();
    for (const s of stats) map.set(`${s.date}|${s.calendarId}`, s);
    return map;
  }, [stats]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayTotals>();
    for (const date of days) map.set(date, emptyDayTotals());
    for (const s of stats) {
      const totals = map.get(s.date);
      if (!totals) continue; // outside the displayed window — the backend already scopes to it, but the window is computed independently here
      totals.successCount += s.successCount;
      totals.errorCount += s.errorCount;
      totals.addedCount += s.addedCount;
      totals.updatedCount += s.updatedCount;
      totals.deletedCount += s.deletedCount;
      totals.totalCount += s.totalCount;
    }
    return map;
  }, [stats, days]);

  const durationOptions: Highcharts.Options = useMemo(
    () =>
      Highcharts.merge(BASE_OPTIONS, chartTheme, {
        chart: { type: "spline" },
        xAxis: { categories },
        yAxis: { title: { text: "Avg duration (ms)" }, min: 0, softMax: 100 },
        tooltip: { shared: true },
        plotOptions: { series: SERIES_PLOT_OPTIONS },
        series: calendars.map((c): Highcharts.SeriesSplineOptions => ({
          type: "spline",
          name: c.source,
          data: days.map(
            (date) =>
              byDayAndCalendar.get(`${date}|${c.calendarId}`)?.avgDurationMs ??
              null,
          ),
        })),
      }),
    [chartTheme, categories, calendars, days, byDayAndCalendar],
  );

  const statusOptions: Highcharts.Options = useMemo(
    () =>
      Highcharts.merge(BASE_OPTIONS, chartTheme, {
        chart: { type: "column" },
        xAxis: { categories },
        yAxis: { title: { text: "Runs" }, min: 0, softMax: 5 },
        plotOptions: {
          series: SERIES_PLOT_OPTIONS,
          column: { stacking: "normal" },
        },
        tooltip: { shared: true },
        series: [
          {
            type: "column",
            name: "Success",
            color: "#52c41a",
            data: days.map((d) => byDay.get(d)?.successCount ?? 0),
          },
          {
            type: "column",
            name: "Error",
            color: "#f5222d",
            data: days.map((d) => byDay.get(d)?.errorCount ?? 0),
          },
        ] satisfies Highcharts.SeriesColumnOptions[],
      }),
    [chartTheme, categories, days, byDay],
  );

  const recordsOptions: Highcharts.Options = useMemo(
    () =>
      Highcharts.merge(BASE_OPTIONS, chartTheme, {
        xAxis: { categories },
        yAxis: { title: { text: "Events" }, min: 0, softMax: 5 },
        plotOptions: {
          series: SERIES_PLOT_OPTIONS,
          column: { stacking: "normal" },
        },
        tooltip: { shared: true },
        series: [
          {
            type: "column",
            name: "Added",
            color: "#52c41a",
            data: days.map((d) => byDay.get(d)?.addedCount ?? 0),
          },
          {
            type: "column",
            name: "Updated",
            color: "#1677ff",
            data: days.map((d) => byDay.get(d)?.updatedCount ?? 0),
          },
          {
            type: "column",
            name: "Deleted",
            color: "#f5222d",
            data: days.map((d) => byDay.get(d)?.deletedCount ?? 0),
          },
          {
            // Themed instead of a hardcoded "#000000" — that reads fine on
            // light's near-black colorText but disappears against a dark
            // background, unlike the semantic status colors above.
            type: "spline",
            name: "Total",
            color: token.colorText,
            data: days.map((d) => byDay.get(d)?.totalCount ?? 0),
          },
        ] satisfies (
          Highcharts.SeriesColumnOptions | Highcharts.SeriesSplineOptions
        )[],
      }),
    [chartTheme, token, categories, days, byDay],
  );

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16, marginBottom: 16 }}>
      <Col xs={24} lg={8}>
        <Spin spinning={isLoading}>
          <Typography.Text strong style={CHART_LABEL_STYLE}>
            Duration
          </Typography.Text>
          <HighchartsReact highcharts={Highcharts} options={durationOptions} />
        </Spin>
      </Col>
      <Col xs={24} lg={8}>
        <Spin spinning={isLoading}>
          <Typography.Text strong style={CHART_LABEL_STYLE}>
            Status
          </Typography.Text>
          <HighchartsReact highcharts={Highcharts} options={statusOptions} />
        </Spin>
      </Col>
      <Col xs={24} lg={8}>
        <Spin spinning={isLoading}>
          <Typography.Text strong style={CHART_LABEL_STYLE}>
            Records
          </Typography.Text>
          <HighchartsReact highcharts={Highcharts} options={recordsOptions} />
        </Spin>
      </Col>
    </Row>
  );
}
