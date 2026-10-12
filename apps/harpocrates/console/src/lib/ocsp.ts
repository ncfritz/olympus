import type { OcspResponder } from "./api/types";

/**
 * OCSP as the console shows it (ADR 0036): which responder signs a CA's
 * responses now, and how close they are to lapsing.
 */

/** Whether a responder signs its CA's responses now. */
export const inService = (
  responder: Pick<OcspResponder, "status" | "notBefore" | "notAfter">,
  now = Date.now(),
): boolean =>
  responder.status === "active" &&
  Date.parse(responder.notBefore) <= now &&
  now < Date.parse(responder.notAfter);

/** The responder in service, if any. */
export const currentResponder = (
  responders: OcspResponder[] | undefined,
): OcspResponder | undefined => (responders ?? []).find((r) => inService(r));

const DAY = 24 * 60 * 60 * 1000;

/**
 * How a CA's soonest-lapsing response looks: fine with more than a day
 * left (they are re-signed daily and last four), a warning with less, an
 * error once lapsed (those are answered tryLater).
 */
export const freshness = (
  earliestNextUpdate: string | undefined,
  now = Date.now(),
): { color: string; label: string } => {
  if (!earliestNextUpdate) return { color: "default", label: "None signed" };
  const left = Date.parse(earliestNextUpdate) - now;
  if (left <= 0) return { color: "red", label: "Lapsed" };
  if (left < DAY) return { color: "gold", label: "Lapsing within a day" };
  return { color: "green", label: "Current" };
};
