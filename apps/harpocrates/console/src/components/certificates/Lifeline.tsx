import { Tooltip } from "antd";
import type { CSSProperties } from "react";
import type { CertificateLineage, LineageVersion } from "@/lib/api/types";
import { formatDate } from "@/lib/labels";
import { gapsOf } from "@/lib/lineages";
import { CATEGORICAL, HEALTH_COLORS } from "../dashboard/chartColors";
import { useChartTheme } from "../dashboard/chartTheme";
import styles from "./Certificates.module.css";

/** A version as the strips colour it. */
export type VersionKind = "current" | "replaced" | "revoked" | "expired";

export const VERSION_LABELS: Record<VersionKind, string> = {
  current: "Current",
  replaced: "Replaced",
  revoked: "Revoked",
  expired: "Expired",
};

export const VERSION_TAGS: Record<VersionKind, string> = {
  current: "green",
  replaced: "default",
  revoked: "red",
  expired: "default",
};

/** A version's kind: the newest valid is current; one after it, replaced. */
export const kindOf = (
  version: LineageVersion,
  newest: boolean,
): VersionKind =>
  version.state === "revoked"
    ? "revoked"
    : newest
      ? version.state === "valid"
        ? "current"
        : "expired"
      : "replaced";

/**
 * The versions' colours: the current the palette's first slot, a replaced
 * one the same paler, revoked the critical status, expired neutral. Each
 * is named in the legend beside the strips.
 */
export const useVersionColors = (): Record<VersionKind, string> => {
  const { token, mode } = useChartTheme();
  const current = CATEGORICAL[mode][0];
  return {
    current,
    replaced: `color-mix(in srgb, ${current} 40%, ${token.colorFillSecondary})`,
    revoked: HEALTH_COLORS.failing,
    expired: token.colorTextQuaternary,
  };
};

/** A span's place on the axis, cut to it: the only values set from code. */
export const place = (
  from: number,
  to: number,
  start: number,
  end: number,
  color?: string,
) => {
  const a = Math.max(from, start);
  const b = Math.min(to, end);
  return {
    "--from": `${((a - start) / (end - start)) * 100}%`,
    "--width": `${(Math.max(b - a, 0) / (end - start)) * 100}%`,
    ...(color ? { "--color": color } : {}),
  } as CSSProperties;
};

/**
 * A lineage's versions end to end on one axis: each in its kind's colour,
 * the gaps between them (nothing valid) dashed, today a line, and, for
 * the timeline, the newest version's renewal point.
 */
export function Lifeline({
  lineage,
  start,
  end,
  now,
  versions = lineage.versions,
  due = false,
  tall = false,
}: {
  lineage: CertificateLineage;
  start: number;
  end: number;
  now: number;
  /** The versions to draw: all of them, or one. */
  versions?: LineageVersion[];
  due?: boolean;
  tall?: boolean;
}) {
  const colors = useVersionColors();
  const count = lineage.versions.length;
  const dueAt = Date.parse(lineage.renewalDueAt);
  return (
    <div
      className={`${styles.lifeline} ${tall ? styles.tall : ""}`}
      role="img"
      aria-label={`${lineage.name}: ${versions
        .map(
          (v) =>
            `${formatDate(v.notBefore)} to ${formatDate(v.notAfter)}, ${v.state}`,
        )
        .join("; ")}`}
    >
      {versions.map((version) => {
        const index = lineage.versions.indexOf(version);
        const kind = kindOf(version, index === 0);
        const ended = version.revokedAt
          ? Math.min(
              Date.parse(version.revokedAt),
              Date.parse(version.notAfter),
            )
          : Date.parse(version.notAfter);
        if (ended < start || Date.parse(version.notBefore) > end) return null;
        return (
          <Tooltip
            key={version.certificateId}
            title={`v${count - index} · ${VERSION_LABELS[kind]} · ${formatDate(version.notBefore)} → ${formatDate(version.notAfter)}`}
          >
            <span
              className={styles.version}
              style={place(
                Date.parse(version.notBefore),
                ended,
                start,
                end,
                colors[kind],
              )}
            />
          </Tooltip>
        );
      })}
      {versions.length > 1 &&
        gapsOf(lineage).map((gap) => (
          <Tooltip
            key={gap.from}
            title={`Nothing valid from ${formatDate(new Date(gap.from).toISOString())} to ${formatDate(new Date(gap.to).toISOString())}`}
          >
            <span
              className={styles.gap}
              style={place(gap.from, gap.to, start, end)}
            />
          </Tooltip>
        ))}
      {due && lineage.state === "valid" && dueAt > start && dueAt < end && (
        <Tooltip title={`Renewal due ${formatDate(lineage.renewalDueAt)}`}>
          <span
            className={`${styles.due} ${lineage.health === "failing" ? styles.dueFailing : ""}`}
            style={place(dueAt, dueAt, start, end)}
          />
        </Tooltip>
      )}
      {now > start && now < end && (
        <span className={styles.today} style={place(now, now, start, end)} />
      )}
    </div>
  );
}
