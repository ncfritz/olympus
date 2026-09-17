"use client";

import { useMemo } from "react";
import { Card, Col, Row } from "antd";
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
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (n - 1 - i)));
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
  return { successCount: 0, errorCount: 0, addedCount: 0, updatedCount: 0, deletedCount: 0, totalCount: 0 };
}

/**
 * Three 30-day charts for the Sync page, sharing its filters (calendar,
 * type, trigger, status) and one underlying `/sync-runs/stats` fetch —
 * pivoted client-side into what each chart needs rather than three
 * separate endpoints.
 */
export function SyncStatsCharts({ filter }: { filter: SyncRunFilterParams }) {
  const { data: stats = [], isLoading } = useSWR(
    ["/sync-runs/stats", filter.calendarId, filter.type, filter.trigger, filter.status],
    () => fetchSyncRunStats({ ...filter, days: STATS_WINDOW_DAYS }),
  );

  const days = useMemo(() => lastNDays(STATS_WINDOW_DAYS), []);
  const categories = useMemo(() => days.map(formatDayLabel), [days]);

  const calendars = useMemo(() => {
    const bySourceLabel = new Map<string, string>();
    for (const s of stats) bySourceLabel.set(s.calendarId, s.source);
    return [...bySourceLabel.entries()].map(([calendarId, source]) => ({ calendarId, source }));
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
    () => ({
      ...BASE_OPTIONS,
      chart: { ...BASE_OPTIONS.chart, type: "spline" },
      xAxis: { categories },
      yAxis: { title: { text: "Avg duration (ms)" }, min: 0, softMax: 100 },
      tooltip: { shared: true },
      plotOptions: { series: SERIES_PLOT_OPTIONS },
      series: calendars.map(
        (c): Highcharts.SeriesSplineOptions => ({
          type: "spline",
          name: c.source,
          data: days.map((date) => byDayAndCalendar.get(`${date}|${c.calendarId}`)?.avgDurationMs ?? null),
        }),
      ),
    }),
    [categories, calendars, days, byDayAndCalendar],
  );

  const statusOptions: Highcharts.Options = useMemo(
    () => ({
      ...BASE_OPTIONS,
      chart: { ...BASE_OPTIONS.chart, type: "column" },
      xAxis: { categories },
      yAxis: { title: { text: "Runs" }, min: 0, softMax: 5 },
      plotOptions: { series: SERIES_PLOT_OPTIONS, column: { stacking: "normal" } },
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
    [categories, days, byDay],
  );

  const recordsOptions: Highcharts.Options = useMemo(
    () => ({
      ...BASE_OPTIONS,
      xAxis: { categories },
      yAxis: { title: { text: "Events" }, min: 0, softMax: 5 },
      plotOptions: { series: SERIES_PLOT_OPTIONS, column: { stacking: "normal" } },
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
          type: "spline",
          name: "Total",
          color: "#000000",
          data: days.map((d) => byDay.get(d)?.totalCount ?? 0),
        },
      ] satisfies (Highcharts.SeriesColumnOptions | Highcharts.SeriesSplineOptions)[],
    }),
    [categories, days, byDay],
  );

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={8}>
        <Card title="Duration" size="small" loading={isLoading}>
          <HighchartsReact highcharts={Highcharts} options={durationOptions} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Status" size="small" loading={isLoading}>
          <HighchartsReact highcharts={Highcharts} options={statusOptions} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Records" size="small" loading={isLoading}>
          <HighchartsReact highcharts={Highcharts} options={recordsOptions} />
        </Card>
      </Col>
    </Row>
  );
}
