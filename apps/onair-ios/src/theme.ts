/*
 * The design's colours (the OnAir canvas). Pure, like `status.ts`.
 */
import type { OnAirStatus } from "./status";

export const colors = {
  background: "#0D0E10",
  surface: "#17181B",
  surfaceRaised: "#1C1D21",
  separator: "#26282C",
  tabBar: "#121316",
  text: "#F3F2EE",
  textSecondary: "#A0A3A9",
  textTertiary: "#8B8E94",
  signRed: "#D8323A",
  signText: "#FFF1F1",
} as const;

/** Strong fills: the Now header, buttons, widgets. */
export const statusFill: Record<OnAirStatus, string> = {
  dnd: "#C8333A",
  interrupt: "#9A6E00",
  free: "#1B7F4F",
  clear: "#3A3D43",
};

/** Dots, row borders and the day strip on the dark background. */
export const statusAccent: Record<OnAirStatus, string> = {
  dnd: "#E5484D",
  interrupt: "#F2B21B",
  free: "#2FA36B",
  clear: "#6B6F76",
};
