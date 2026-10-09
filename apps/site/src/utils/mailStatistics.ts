import type {
  MailLabelYear,
  MailSenderYear,
} from "@ncfritz/olympus-sdk/minerva";

/** The years from the earliest to the latest in `rows`, every year between. */
export const yearSpan = (rows: { year: number }[]): number[] => {
  if (rows.length === 0) return [];
  const years = rows.map((r) => r.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
};

/**
 * A line per sender over `years`, in the order the senders first appear,
 * with 0 for a year it sent nothing (the API leaves those out).
 */
export const senderSeries = (
  rows: MailSenderYear[],
  years: number[],
): { name: string; data: number[] }[] => {
  const bySender = new Map<string, Map<number, number>>();
  for (const row of rows) {
    if (!bySender.has(row.address)) bySender.set(row.address, new Map());
    bySender.get(row.address)!.set(row.year, row.messages);
  }
  return [...bySender].map(([name, counts]) => ({
    name,
    data: years.map((y) => counts.get(y) ?? 0),
  }));
};

/** The labels in `rows` busiest first, ties by name. */
export const labelsByVolume = (rows: MailLabelYear[]): string[] => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.name, (totals.get(row.name) ?? 0) + row.messages);
  }
  return [...totals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
};

/** A heatmap cell: its year and label indexes, shade and real count. */
export type HeatmapCell = {
  x: number;
  y: number;
  value: number;
  count: number;
};

/**
 * Heatmap cells, one for every label and year so an empty year shows as
 * empty rather than missing. Each label is shaded against its own busiest
 * year (`value` 0 to 1), so one label with most of the mail does not wash
 * out the rest and a label's rise and fade shows; `count` is the real
 * number, for the tooltip.
 */
export const labelHeatmap = (
  rows: MailLabelYear[],
  labels: string[],
  years: number[],
): HeatmapCell[] => {
  const counts = new Map(
    rows.map((r) => [`${r.name}\u0000${r.year}`, r.messages]),
  );
  return labels.flatMap((label, y) => {
    const row = years.map((year) => counts.get(`${label}\u0000${year}`) ?? 0);
    const busiest = Math.max(...row, 0);
    return row.map((count, x) => ({
      x,
      y,
      value: busiest > 0 ? count / busiest : 0,
      count,
    }));
  });
};

/** A sender's line with no point for a year it sent nothing, for a log axis. */
export const withoutZeros = (data: number[]): (number | null)[] =>
  data.map((n) => (n > 0 ? n : null));
