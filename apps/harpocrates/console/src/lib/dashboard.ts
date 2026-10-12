import type { AttentionItem, ExpiringCertificate } from "./api/types";

/**
 * The dashboard as the console shows it (the canvas's "Operations"
 * design): how long until something, where a certificate sits on the
 * 90-day lanes, and where an attention item leads.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** How far the expiry lanes look ahead, as the service does. */
export const LANE_DAYS = 90;

/** "5 h", "4 days", "11 months", "3 y 9 m": how long until a time. */
export const timeUntil = (iso: string, now = Date.now()): string => {
  const left = Date.parse(iso) - now;
  if (left <= 0) return "now";
  if (left < DAY) return `${Math.max(1, Math.round(left / HOUR))} h`;
  const days = Math.round(left / DAY);
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months - years * 12;
  return rest ? `${years} y ${rest} m` : `${years} years`;
};

/** What a certificate on the lanes is: its band, colour and label. */
export const band = (
  certificate: ExpiringCertificate,
  now = Date.now(),
): { color: string; label: string } =>
  Date.parse(certificate.renewalDueAt) <= now
    ? { color: "red", label: "Past its renewal point" }
    : certificate.renewal === "manual"
      ? { color: "orange", label: "Needs a person" }
      : { color: "blue", label: "Renews itself" };

/** A certificate's short name on the lanes: its first DNS label. */
export const shortName = (name: string): string =>
  /^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(name) ? name.split(".")[0] : name;

/** How many days apart two chips on one row of a lane must be. */
const ROW_GAP_DAYS = 12;

/** The most rows a lane stacks its chips in before they overlap. */
export const LANE_ROWS = 3;

export type LaneChip = {
  certificate: ExpiringCertificate;
  /** Its position along the lane, 0 to 100. */
  left: number;
  row: number;
};

/**
 * A lane's chips, placed by time to expiry and stacked in rows so that
 * close ones do not overlap; past the last row they share it.
 */
export const placeChips = (
  certificates: ExpiringCertificate[],
  now = Date.now(),
): LaneChip[] => {
  const lastDay: number[] = [];
  return [...certificates]
    .sort((a, b) => Date.parse(a.notAfter) - Date.parse(b.notAfter))
    .map((certificate) => {
      const day = (Date.parse(certificate.notAfter) - now) / DAY;
      let row = lastDay.findIndex((last) => day - last >= ROW_GAP_DAYS);
      if (row === -1) {
        row = Math.min(lastDay.length, LANE_ROWS - 1);
      }
      lastDay[row] = day;
      return {
        certificate,
        left: Math.min(Math.max((day / LANE_DAYS) * 100, 0), 100),
        row,
      };
    });
};

/** Where an attention item leads in the console. */
export const attentionHref = (item: AttentionItem): string => {
  switch (item.subjectType) {
    case "certificate":
      return `/certificates?certificateId=${item.subjectId}`;
    case "deploy-target":
      return `/deploy-targets?id=${item.subjectId}`;
    default:
      return `/ca?id=${item.subjectId}`;
  }
};
