"use client";

import type { FlagStyle } from "@/lib/availability";

/**
 * A small bordered, rounded chip carrying the same left-edge flag styling
 * as a calendar event (see flagFor) plus a friendly label — used in the
 * list view's Status column so it visually matches the calendar views'
 * event indicators instead of AntD's default solid-fill Tag.
 */
export function StatusChip({
  flag,
  label,
}: {
  flag: FlagStyle;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        height: 20,
        border: "1px solid #d9d9d9",
        borderRadius: 6,
        overflow: "hidden",
        background: "#ffffff",
        verticalAlign: "middle",
      }}
    >
      <span style={{ width: 5, flexShrink: 0, ...flag }} />
      <span
        style={{
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          fontSize: 12,
          lineHeight: "18px",
          whiteSpace: "nowrap",
          color: "#1f1f1f",
        }}
      >
        {label}
      </span>
    </span>
  );
}
