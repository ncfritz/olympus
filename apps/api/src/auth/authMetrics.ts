import { Counter } from "prom-client";
import type { AuthOutcome, Listener } from "./principal";

/**
 * What the guard decided, by listener and reason (ADR 0018). In report
 * mode `would_reject` is what enforcement will turn into `reject`, so
 * this is the counter to watch before switching a listener over.
 */
const decisions = new Counter({
  name: "auth_decisions_total",
  help: "Authentication decisions, by listener, outcome and reason",
  labelNames: ["listener", "outcome", "reason"],
});

export const recordAuthDecision = (
  listener: Listener,
  outcome: AuthOutcome,
  reason: string | undefined,
): void => {
  decisions.inc({ listener, outcome, reason: reasonLabel(reason) });
};

// The reason is a label, so it stays a small fixed set: the detail
// (which service, which header) goes to the log, not the metric.
const KNOWN = [
  "no credentials",
  "no client certificate",
  "not a TLS connection",
  "unknown service",
  "client header mismatch",
  "wrong issuer",
  "invalid token",
  "tokens not configured",
  "role",
] as const;

const reasonLabel = (reason: string | undefined): string => {
  if (!reason) return "none";
  if (reason.startsWith("unknown service")) return "unknown service";
  // A certificate the handshake accepted but the wrong CA signed: a device
  // certificate on the services listener (ADR 0023). Worth its own label —
  // it means something quite different from an unknown service.
  if (reason.startsWith("issuer ")) return "wrong issuer";
  // Every way a token fails verification is one label: the detail (expired,
  // unknown kid, bad signature) is in the log, and a metric with a label per
  // failure mode is a cardinality problem waiting to happen.
  if (reason.startsWith("invalid token")) return "invalid token";
  if (reason === "tokens are not configured") return "tokens not configured";
  if (reason.startsWith("client header")) return "client header mismatch";
  if (reason.startsWith("needs one of")) return "role";
  return KNOWN.find((known) => reason === known) ?? "other";
};
