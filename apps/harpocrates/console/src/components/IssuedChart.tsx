"use client";

import { useThemeMode } from "@ncfritz/olympus-console";
import { Flex, Tooltip, Typography } from "antd";
import { useState } from "react";
import type { IssuedCount, IssuedTier } from "@/lib/api/types";
import { ISSUED_TIERS, issuedTypeName } from "@/lib/labels";
import styles from "./IssuedChart.module.css";

/** The chart's size and its two rings, inner (tiers) then outer (types). */
const SIZE = 200;
const CENTER = SIZE / 2;
const INNER = { from: 50, to: 72 };
const OUTER = { from: 76, to: 100 };

/** The tiers in their order around the ring and their colour slots. */
const TIER_ORDER: IssuedTier[] = ["intermediate", "issuing", "leaf"];

/**
 * A type's colour: its tier's, lightened a step for each type after the
 * first, so a tier's types read as its family.
 */
const TINTS = [0, 28, 46, 60, 70];
const tint = (index: number) => TINTS[Math.min(index, TINTS.length - 1)];

type Segment = {
  key: string;
  tier: IssuedTier;
  label: string;
  count: number;
  start: number;
  end: number;
  /** How far toward the surface its colour is mixed, percent. */
  tint: number;
};

const point = (radius: number, angle: number) => [
  CENTER + radius * Math.sin(angle),
  CENTER - radius * Math.cos(angle),
];

/** A ring's slice from one angle to another, clockwise from the top. */
const arc = (
  ring: { from: number; to: number },
  start: number,
  end: number,
): string => {
  // A whole ring is drawn as two halves: an arc cannot end where it began.
  if (end - start >= 2 * Math.PI - 1e-6) {
    const half = start + Math.PI;
    return `${arc(ring, start, half)} ${arc(ring, half, end)}`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(ring.to, start);
  const [x2, y2] = point(ring.to, end);
  const [x3, y3] = point(ring.from, end);
  const [x4, y4] = point(ring.from, start);
  return [
    `M ${x1} ${y1}`,
    `A ${ring.to} ${ring.to} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${ring.from} ${ring.from} 0 ${large} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
};

/** The two rings' segments, from the counts. */
const segmentsOf = (counts: IssuedCount[]) => {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const tiers: Segment[] = [];
  const types: Segment[] = [];
  let angle = 0;
  for (const tier of TIER_ORDER) {
    const own = counts.filter((c) => c.tier === tier && c.count > 0);
    const sum = own.reduce((s, c) => s + c.count, 0);
    if (!sum) continue;
    const start = angle;
    own.forEach((c, index) => {
      const sweep = (c.count / total) * 2 * Math.PI;
      types.push({
        key: `${tier}/${c.type}`,
        tier,
        label: issuedTypeName(c),
        count: c.count,
        start: angle,
        end: angle + sweep,
        tint: tint(index),
      });
      angle += sweep;
    });
    tiers.push({
      key: tier,
      tier,
      label: ISSUED_TIERS[tier],
      count: sum,
      start,
      end: angle,
      tint: 0,
    });
  }
  return { total, tiers, types };
};

/** A segment's fill, as a CSS colour from the tier's variable. */
const fillOf = (segment: Segment) =>
  segment.tint
    ? `color-mix(in srgb, var(--tier-${segment.tier}), var(--tint-toward) ${segment.tint}%)`
    : `var(--tier-${segment.tier})`;

/**
 * What is beneath a CA: the CAs below it and the leaves in use, as two
 * rings, tiers inside and their types outside, with the counts beside
 * them (the legend and the table both). The centre is left empty.
 */
export function IssuedChart({ counts }: { counts: IssuedCount[] }) {
  const [hovered, setHovered] = useState<string>();
  const { resolvedMode } = useThemeMode();
  const { total, tiers, types } = segmentsOf(counts);
  const dimmed = (segment: Segment) =>
    hovered !== undefined &&
    hovered !== segment.key &&
    !segment.key.startsWith(`${hovered}/`) &&
    !hovered.startsWith(`${segment.key}/`);

  const ring = (segments: Segment[], radii: typeof INNER) =>
    segments.map((segment) => (
      <Tooltip
        key={segment.key}
        title={`${segment.label}: ${segment.count}`}
        mouseEnterDelay={0}
      >
        <path
          d={arc(radii, segment.start, segment.end)}
          fill={fillOf(segment)}
          className={`${styles.segment} ${dimmed(segment) ? styles.dimmed : ""}`}
          onMouseEnter={() => setHovered(segment.key)}
          onMouseLeave={() => setHovered(undefined)}
        />
      </Tooltip>
    ));

  return (
    <Flex
      gap="large"
      align="center"
      className={`${styles.chart} ${resolvedMode === "dark" ? styles.dark : ""}`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${total} beneath it: ${tiers.map((t) => `${t.label} ${t.count}`).join(", ")}`}
      >
        {total === 0 ? (
          <>
            <path d={arc(INNER, 0, 2 * Math.PI)} className={styles.track} />
            <path d={arc(OUTER, 0, 2 * Math.PI)} className={styles.track} />
          </>
        ) : (
          <>
            {ring(tiers, INNER)}
            {ring(types, OUTER)}
          </>
        )}
      </svg>
      <Flex vertical gap={4} className={styles.legend}>
        <Typography.Text type="secondary">
          {total === 0 ? "Nothing beneath it yet" : `${total} beneath it`}
        </Typography.Text>
        {tiers.map((tier) => (
          <Flex vertical key={tier.key}>
            <LegendRow
              segment={tier}
              strong
              onHover={setHovered}
              hovered={hovered}
            />
            {types
              .filter((type) => type.tier === tier.tier)
              .map((type) => (
                <LegendRow
                  key={type.key}
                  segment={type}
                  onHover={setHovered}
                  hovered={hovered}
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
        <rect width={10} height={10} rx={2} fill={fillOf(segment)} />
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
