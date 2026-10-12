/**
 * The dashboard's chart colours: the data-viz palette's first three
 * categorical slots (validated as a set in both modes, as IssuedChart's
 * are) for activity, and its status steps for renewal health, which
 * always carry a label beside them.
 */
export const ACTIVITY_COLORS = {
  light: { issued: "#2a78d6", renewed: "#1baf7a", revoked: "#eb6834" },
  dark: { issued: "#3987e5", renewed: "#199e70", revoked: "#d95926" },
} as const;

export const HEALTH_COLORS = {
  healthy: "#0ca30c",
  renewing: { light: "#2a78d6", dark: "#3987e5" },
  needsPerson: "#fab219",
  failing: "#d03b3b",
} as const;
