import { Flex, Progress, Tooltip, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { AuditPoint } from "@/lib/api/types";
import {
  byGroup,
  byWho,
  peopleByHour,
  perDay,
  SURFACE_ORDER,
  SURFACES,
} from "@/lib/audit";
import { CATEGORICAL } from "../dashboard/chartColors";
import { baseOptions, useChartTheme } from "../dashboard/chartTheme";
import { GraphBox } from "../dashboard/GraphBox";
import { PrincipalName } from "../PrincipalName";
import styles from "./Audit.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A heat cell's strength, 0 to 1: the only value set from code. */
const heat = (count: number, most: number) =>
  ({
    "--heat": most ? `${Math.round((count / most) * 100)}%` : "0%",
  }) as CSSProperties;

/**
 * The activity tab (the canvas's Audit P): events each day by surface,
 * what they concern, when people act, and who, over the last 30 days.
 */
export function ActivityGraphs({
  points,
  now,
  days,
}: {
  points: AuditPoint[];
  now: number;
  days: number;
}) {
  const { token, mode } = useChartTheme();
  const daily = useMemo(() => perDay(points, days, now), [points, days, now]);
  const groups = useMemo(() => byGroup(points), [points]);
  const hours = useMemo(() => peopleByHour(points), [points]);
  const who = useMemo(() => byWho(points), [points]);
  const most = Math.max(0, ...hours.flat());
  const surfaceColors = useMemo(
    (): Record<string, string> => ({
      system: token.colorTextQuaternary,
      renewal: CATEGORICAL[mode][2],
      acme: CATEGORICAL[mode][0],
      api: CATEGORICAL[mode][1],
      cli: CATEGORICAL[mode][3],
    }),
    [token.colorTextQuaternary, mode],
  );

  const dailyOptions = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 200 },
      accessibility: {
        description: daily
          .map(
            (d) =>
              `${d.label}: ${SURFACE_ORDER.map((s) => `${d.counts[s]} ${SURFACES[s].label}`).join(", ")}`,
          )
          .join("; "),
      },
      xAxis: {
        ...base.xAxis,
        categories: daily.map((d) => d.label),
        labels: {
          step: 5,
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      yAxis: { ...base.yAxis, reversedStacks: false },
      tooltip: { ...base.tooltip, shared: true },
      plotOptions: {
        column: {
          stacking: "normal",
          borderWidth: 0,
          borderRadius: 1,
          groupPadding: 0.06,
          pointPadding: 0.04,
          animation: false,
        },
      },
      series: SURFACE_ORDER.map((surface) => ({
        type: "column" as const,
        name: SURFACES[surface].label,
        color: surfaceColors[surface],
        data: daily.map((d) => d.counts[surface] ?? 0),
      })),
    };
  }, [daily, token, surfaceColors]);

  const shownSlices = useMemo(() => {
    const slices = groups.map((g, i) => ({
      ...g,
      color:
        i < CATEGORICAL[mode].length - 1
          ? (CATEGORICAL[mode][i] as string)
          : token.colorTextQuaternary,
    }));
    return [
      ...slices.slice(0, 5),
      ...(slices.length > 5
        ? [
            {
              key: "rest",
              label: "Everything else",
              count: slices.slice(5).reduce((sum, s) => sum + s.count, 0),
              color: token.colorTextQuaternary,
            },
          ]
        : []),
    ];
  }, [groups, mode, token.colorTextQuaternary]);
  const total = shownSlices.reduce((sum, s) => sum + s.count, 0);
  const groupOptions = useMemo((): Highcharts.Options => {
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
        text: `<b>${total.toLocaleString()}</b><br/>events`,
        verticalAlign: "middle",
        y: 6,
        style: { color: token.colorText, fontSize: "14px" },
      },
      accessibility: {
        description: shownSlices
          .map((s) => `${s.label}: ${s.count}`)
          .join(", "),
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
          name: "Events",
          data: total
            ? shownSlices.map((s) => ({
                name: s.label,
                y: s.count,
                color: s.color,
              }))
            : [{ name: "None", y: 1, color: token.colorFillTertiary }],
          enableMouseTracking: total > 0,
        },
      ],
    };
  }, [shownSlices, total, token]);

  const mostWho = Math.max(1, ...who.map((w) => w.count));

  return (
    <div className={styles.graphs}>
      <GraphBox
        title="Events each day"
        extra={
          <Flex gap="middle" wrap className={styles.legend}>
            {SURFACE_ORDER.map((surface) => (
              <span key={surface} className={styles.legendItem}>
                <svg width={10} height={10} aria-hidden>
                  <rect
                    width={10}
                    height={10}
                    rx={2}
                    fill={surfaceColors[surface]}
                  />
                </svg>
                {SURFACES[surface].label}
              </span>
            ))}
          </Flex>
        }
      >
        <HighchartsReact highcharts={Highcharts} options={dailyOptions} />
      </GraphBox>
      <GraphBox title="What they concern">
        <Flex gap="middle" align="center" wrap>
          <div className={styles.ring}>
            <HighchartsReact highcharts={Highcharts} options={groupOptions} />
          </div>
          <Flex vertical gap={6} className={styles.ringLegend}>
            {shownSlices.map((s) => (
              <Flex key={s.key} align="center" gap="small">
                <svg width={10} height={10} aria-hidden>
                  <rect width={10} height={10} rx={2} fill={s.color} />
                </svg>
                <Typography.Text className={styles.grow} ellipsis>
                  {s.label}
                </Typography.Text>
                <Typography.Text strong>
                  {s.count.toLocaleString()}
                </Typography.Text>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </GraphBox>
      <GraphBox
        title="When people act"
        extra={
          <Typography.Text type="secondary" className={styles.small}>
            Your time
          </Typography.Text>
        }
      >
        <div
          className={styles.heat}
          role="img"
          aria-label="People's events by weekday and hour"
        >
          {hours.map((row, day) => (
            <div key={day} className={styles.heatRow}>
              <Typography.Text type="secondary" className={styles.small}>
                {WEEKDAYS[day]}
              </Typography.Text>
              {row.map((count, hour) => (
                <Tooltip
                  key={hour}
                  title={`${WEEKDAYS[day]} ${String(hour).padStart(2, "0")}:00: ${count}`}
                >
                  <span
                    className={`${styles.heatCell} ${count ? styles.heatOn : ""}`}
                    style={heat(count, most)}
                  />
                </Tooltip>
              ))}
            </div>
          ))}
          <div className={styles.heatRow}>
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <Typography.Text
                key={hour}
                type="secondary"
                className={styles.tiny}
              >
                {hour % 6 === 0 ? String(hour).padStart(2, "0") : ""}
              </Typography.Text>
            ))}
          </div>
        </div>
      </GraphBox>
      <GraphBox title="Who">
        <Flex vertical gap={6}>
          {who.slice(0, 6).map((w) => (
            <div key={w.key} className={styles.whoRow}>
              <Typography.Text ellipsis>
                {w.principal ? (
                  <PrincipalName principal={w.principal} />
                ) : (
                  w.label
                )}
              </Typography.Text>
              <Progress
                percent={(w.count / mostWho) * 100}
                showInfo={false}
                size="small"
                strokeColor={
                  w.principal ? CATEGORICAL[mode][1] : token.colorTextQuaternary
                }
              />
              <Typography.Text strong className={styles.count}>
                {w.count.toLocaleString()}
              </Typography.Text>
            </div>
          ))}
        </Flex>
      </GraphBox>
    </div>
  );
}
