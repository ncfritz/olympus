"use client";

import { useThemeMode } from "@ncfritz/olympus-console";
import { Flex, theme, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo, useRef, useState } from "react";
import type { IssuedCount, IssuedTier } from "@/lib/api/types";
import { ISSUED_TIERS, issuedTypeName } from "@/lib/labels";
import styles from "./IssuedChart.module.css";

/** The chart's size, square. */
const SIZE = 200;

/**
 * The rings, as fractions of the chart: tiers inside from 50% to 72% of
 * the radius, types outside from 76% to 100%. Highcharts sizes a pie's
 * hole against the pie itself, so the inner ring's hole is 50/72 of it.
 * Half the radius is left empty in the centre.
 */
const INNER = { size: "72%", innerSize: `${(50 / 72) * 100}%` };
const OUTER = { size: "100%", innerSize: "76%" };

/** The tiers in their order around the rings. */
const TIER_ORDER: IssuedTier[] = ["intermediate", "issuing", "leaf"];

/**
 * The tiers' colours: the first three categorical slots of the data-viz
 * palette, validated as a set against each surface (light: the leaves'
 * aqua is under 3:1, so every segment is named and counted in the legend).
 */
const TIER_COLORS: Record<"light" | "dark", Record<IssuedTier, string>> = {
  light: { intermediate: "#2a78d6", issuing: "#eb6834", leaf: "#1baf7a" },
  dark: { intermediate: "#3987e5", issuing: "#d95926", leaf: "#199e70" },
};

/**
 * A type's colour: its tier's, a step lighter for each type after the
 * first (toward the surface in the light theme, toward white in the dark,
 * where the surface would sink it), so a tier's types read as its family.
 */
const TINTS = [0, 0.28, 0.46, 0.6, 0.7];

type Segment = {
  key: string;
  tier: IssuedTier;
  label: string;
  count: number;
  color: string;
};

/** The two rings' segments, from the counts, coloured. */
const segmentsOf = (
  counts: IssuedCount[],
  colors: Record<IssuedTier, string>,
  toward: string,
) => {
  const tiers: Segment[] = [];
  const types: Segment[] = [];
  for (const tier of TIER_ORDER) {
    const own = counts.filter((c) => c.tier === tier && c.count > 0);
    if (!own.length) continue;
    own.forEach((c, index) => {
      const amount = TINTS[Math.min(index, TINTS.length - 1)];
      types.push({
        key: `${tier}/${c.type}`,
        tier,
        label: issuedTypeName(c),
        count: c.count,
        color: amount
          ? (Highcharts.color(colors[tier]).tweenTo(
              Highcharts.color(toward),
              amount,
            ) as string)
          : colors[tier],
      });
    });
    tiers.push({
      key: tier,
      tier,
      label: ISSUED_TIERS[tier],
      count: own.reduce((sum, c) => sum + c.count, 0),
      color: colors[tier],
    });
  }
  return {
    total: tiers.reduce((sum, t) => sum + t.count, 0),
    tiers,
    types,
  };
};

/**
 * What is beneath a CA: the CAs below it and the leaves in use, as a
 * two-ring Highcharts doughnut, tiers inside and their types outside, with
 * the centre left empty and the counts beside it (the legend and the table
 * both). Hovering a segment or a legend row names it in both.
 */
export function IssuedChart({ counts }: { counts: IssuedCount[] }) {
  const { token } = theme.useToken();
  const { resolvedMode } = useThemeMode();
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const [hovered, setHovered] = useState<string>();
  const { total, tiers, types } = useMemo(
    () =>
      segmentsOf(
        counts,
        TIER_COLORS[resolvedMode],
        resolvedMode === "dark" ? "#ffffff" : token.colorBgContainer,
      ),
    [counts, resolvedMode, token.colorBgContainer],
  );

  const options: Highcharts.Options = useMemo(() => {
    const ring = (
      name: string,
      segments: Segment[],
      sizes: typeof INNER,
    ): Highcharts.SeriesPieOptions => ({
      type: "pie",
      name,
      ...sizes,
      data: segments.length
        ? segments.map((s) => ({
            id: s.key,
            name: s.label,
            y: s.count,
            color: s.color,
          }))
        : // Nothing beneath it: the ring, empty, as a track.
          [{ name: "Nothing", y: 1, color: token.colorFillTertiary }],
      enableMouseTracking: segments.length > 0,
    });
    return {
      chart: {
        type: "pie",
        width: SIZE,
        height: SIZE,
        margin: 0,
        spacing: [0, 0, 0, 0],
        backgroundColor: "transparent",
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      accessibility: {
        description: `${total} beneath it: ${tiers.map((t) => `${t.label} ${t.count}`).join(", ")}`,
        point: { valueSuffix: "" },
      },
      tooltip: {
        backgroundColor: token.colorBgElevated,
        borderColor: token.colorBorderSecondary,
        style: { color: token.colorText },
        headerFormat: "",
        pointFormat: "{point.name}: <b>{point.y}</b>",
      },
      plotOptions: {
        pie: {
          center: ["50%", "50%"],
          startAngle: 0,
          dataLabels: { enabled: false },
          // A 2px gap of surface between segments.
          borderWidth: 2,
          borderColor: token.colorBgContainer,
          borderRadius: 0,
          animation: false,
          states: {
            hover: { halo: { size: 0 }, brightness: 0.05 },
            inactive: { opacity: 0.35 },
          },
          point: {
            events: {
              mouseOver() {
                setHovered(this.options.id);
              },
              mouseOut() {
                setHovered(undefined);
              },
            },
          },
        },
      },
      series: [ring("Tier", tiers, INNER), ring("Type", types, OUTER)],
    };
  }, [tiers, types, total, token]);

  /** A legend row's hover, shown on the chart as its segment's own. */
  const hoverPoint = (key: string | undefined) => {
    const chart = chartRef.current?.chart;
    if (!chart) return;
    const points = chart.series.flatMap((series) => series.points);
    if (key === undefined) {
      points.forEach((p) => p.setState(""));
      chart.tooltip.hide(0);
      setHovered(undefined);
      return;
    }
    const target = chart.get(key) as Highcharts.Point | undefined;
    if (!target) return;
    points.forEach((p) => p.setState(p === target ? "hover" : "inactive"));
    chart.tooltip.refresh(target);
    setHovered(key);
  };

  return (
    <Flex gap="large" align="center" wrap>
      <div className={styles.plot}>
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          options={options}
        />
      </div>
      <Flex vertical gap={4} className={styles.legend}>
        <Typography.Text type="secondary">
          {total === 0 ? "Nothing beneath it yet" : `${total} beneath it`}
        </Typography.Text>
        {tiers.map((tier) => (
          <Flex vertical key={tier.key}>
            <LegendRow
              segment={tier}
              strong
              hovered={hovered}
              onHover={hoverPoint}
            />
            {types
              .filter((type) => type.tier === tier.tier)
              .map((type) => (
                <LegendRow
                  key={type.key}
                  segment={type}
                  hovered={hovered}
                  onHover={hoverPoint}
                />
              ))}
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}

function LegendRow({
  segment,
  strong,
  hovered,
  onHover,
}: {
  segment: Segment;
  strong?: boolean;
  hovered?: string;
  onHover: (key: string | undefined) => void;
}) {
  return (
    <Flex
      align="center"
      gap="small"
      className={`${styles.row} ${strong ? "" : styles.typeRow} ${hovered === segment.key ? styles.active : ""}`}
      onMouseEnter={() => onHover(segment.key)}
      onMouseLeave={() => onHover(undefined)}
    >
      <svg width={10} height={10} aria-hidden className={styles.swatch}>
        <rect width={10} height={10} rx={2} fill={segment.color} />
      </svg>
      <Typography.Text strong={strong} className={styles.label}>
        {segment.label}
      </Typography.Text>
      <Typography.Text strong={strong} className={styles.count}>
        {segment.count}
      </Typography.Text>
    </Flex>
  );
}
