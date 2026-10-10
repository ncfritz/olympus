import type { Issuer } from "./api/types";

/** What an offline CA signs in its ceremonies (ADR 0032, Three shapes). */
export type Signs = "intermediate" | "issuing" | "leaf";

/** As the service decides it: an intermediate signs issuing CAs; a root, its shape's. */
export const signsOf = (issuer: Pick<Issuer, "tier" | "shape">): Signs =>
  issuer.tier === "intermediate"
    ? "issuing"
    : issuer.shape === "two_tier"
      ? "issuing"
      : issuer.shape === "direct"
        ? "leaf"
        : "intermediate";

export const SIGNS_LABEL: Record<Signs, string> = {
  intermediate: "intermediate CAs",
  issuing: "issuing CAs",
  leaf: "leaf certificates",
};
