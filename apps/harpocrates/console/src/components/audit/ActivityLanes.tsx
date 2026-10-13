import { Flex, Segmented, theme, Typography } from "antd";
import { useMemo, useState } from "react";
import type { AuditGroup, AuditPoint } from "@/lib/api/types";
import { GROUPS } from "@/lib/audit";
import { isPerson } from "@/lib/principals";
import { CATEGORICAL, HEALTH_COLORS } from "../dashboard/chartColors";
import { useChartTheme } from "../dashboard/chartTheme";
import styles from "./Audit.module.css";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const RANGES = { "48 hours": 2, "14 days": 14, "90 days": 90 } as const;
type Range = keyof typeof RANGES;

/** The drawing's size: its labels, its lanes, its width. */
const LABEL = 150;
const LANE = 30;
const WIDTH = 1100;
const TOP = 22;

/**
 * The lanes tab (the canvas's Audit R): every event over the range, a
 * lane to each group; automatic ones small, a person's larger, sensitive
 * ones a diamond. Choosing a lane filters the list beneath to its group.
 */
export function ActivityLanes({
  points,
  now,
  selected,
  onSelect,
}: {
  points: AuditPoint[];
  now: number;
  selected: AuditGroup[];
  onSelect: (group: AuditGroup) => void;
}) {
  const { token: t } = theme.useToken();
  const { mode } = useChartTheme();
  const [range, setRange] = useState<Range>("14 days");
  const days = RANGES[range];
  const start = now - days * DAY;
  const shown = useMemo(
    () => points.filter((p) => Date.parse(p.occurredAt) >= start),
    [points, start],
  );
  // A lane to each group with events in the range, or chosen.
  const lanes = GROUPS.filter(
    (g) => selected.includes(g.key) || shown.some((p) => p.group === g.key),
  );
  const x = (time: number) =>
    LABEL + ((time - start) / (now - start)) * (WIDTH - LABEL - 12);
  const height = TOP + lanes.length * LANE + 4;
  const tickEvery = days <= 2 ? 6 * HOUR : days <= 14 ? DAY : 7 * DAY;
  const ticks: number[] = [];
  for (let tick = now; tick >= start; tick -= tickEvery) ticks.push(tick);
  const label = (tick: number) =>
    tick === now
      ? "Now"
      : days <= 2
        ? `-${Math.round((now - tick) / HOUR)} h`
        : `-${Math.round((now - tick) / DAY)} d`;
  const person = CATEGORICAL[mode][1];

  return (
    <section className={styles.lanesBox} aria-label="Events by kind, over time">
      <Flex justify="space-between" align="center" gap="middle" wrap>
        <Typography.Text strong className={styles.boxTitle}>
          {shown.length.toLocaleString()} events, the last {range}
        </Typography.Text>
        <Flex gap="middle" wrap className={styles.legend}>
          <span className={styles.legendItem}>
            <svg width={10} height={10} aria-hidden>
              <circle cx={5} cy={5} r={2.6} fill={t.colorTextTertiary} />
            </svg>
            Automatic
          </span>
          <span className={styles.legendItem}>
            <svg width={10} height={10} aria-hidden>
              <circle cx={5} cy={5} r={4.5} fill={person} />
            </svg>
            By a person
          </span>
          <span className={styles.legendItem}>
            <svg width={12} height={12} aria-hidden>
              <rect
                x={2}
                y={2}
                width={8}
                height={8}
                transform="rotate(45 6 6)"
                fill={HEALTH_COLORS.needsPerson}
              />
            </svg>
            Sensitive
          </span>
        </Flex>
        <Segmented<Range>
          aria-label="Range"
          options={Object.keys(RANGES) as Range[]}
          value={range}
          onChange={setRange}
        />
      </Flex>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className={styles.lanes}
        role="group"
        aria-label="A lane to each kind of event"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={TOP - 4}
              y2={height}
              stroke={t.colorBorderSecondary}
            />
            <text
              x={x(tick)}
              y={12}
              textAnchor="middle"
              fontSize={11}
              fill={tick === now ? t.colorPrimary : t.colorTextSecondary}
            >
              {label(tick)}
            </text>
          </g>
        ))}
        {lanes.map((lane, i) => {
          const y = TOP + i * LANE;
          const on = selected.includes(lane.key);
          const inLane = shown.filter((p) => p.group === lane.key);
          return (
            <g key={lane.key}>
              <g
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${lane.label}: ${inLane.length} events; filter the list to them`}
                className={styles.lane}
                onClick={() => onSelect(lane.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(lane.key);
                  }
                }}
              >
                <rect
                  x={0}
                  y={y}
                  width={WIDTH}
                  height={LANE}
                  fill={
                    on
                      ? t.colorPrimaryBg
                      : i % 2
                        ? "transparent"
                        : t.colorFillQuaternary
                  }
                />
                <text
                  x={LABEL - 12}
                  y={y + LANE / 2 + 4}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={on ? 600 : 400}
                  fill={on ? t.colorPrimary : t.colorText}
                >
                  {lane.label} ({inLane.length})
                </text>
              </g>
              {inLane.map((p) => {
                const cx = x(Date.parse(p.occurredAt));
                const cy = y + LANE / 2;
                if (p.sensitive) {
                  return (
                    <rect
                      key={p.sequence}
                      x={cx - 5}
                      y={cy - 5}
                      width={10}
                      height={10}
                      transform={`rotate(45 ${cx} ${cy})`}
                      fill={HEALTH_COLORS.needsPerson}
                      stroke={t.colorBgContainer}
                      strokeWidth={1.5}
                    >
                      <title>{`#${p.sequence} ${p.kind}`}</title>
                    </rect>
                  );
                }
                return isPerson(p.principal) ? (
                  <circle
                    key={p.sequence}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={person}
                    stroke={t.colorBgContainer}
                    strokeWidth={1.5}
                  >
                    <title>{`#${p.sequence} ${p.kind}`}</title>
                  </circle>
                ) : (
                  <circle
                    key={p.sequence}
                    cx={cx}
                    cy={cy + ((Number(p.sequence) % 7) - 3) * 1.6}
                    r={2.6}
                    fill={t.colorTextTertiary}
                    fillOpacity={0.6}
                  >
                    <title>{`#${p.sequence} ${p.kind}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Typography.Text type="secondary" className={styles.small}>
        Choose a lane to filter the list to it; choose it again to clear it.
      </Typography.Text>
    </section>
  );
}
