import type { IssuerShape, IssuerStatus, IssuerTier } from "./api/types";

/** A root's shape (ADR 0032, Three shapes), as the console explains it. */
export const SHAPES: Record<
  IssuerShape,
  { label: string; signs: string; summary: string }
> = {
  three_tier: {
    label: "Three tiers",
    signs: "intermediates",
    summary:
      "Root → offline intermediates → online issuing CAs. The root signs only in ceremonies, rarely; an intermediate can be replaced without touching the root.",
  },
  two_tier: {
    label: "Two tiers",
    signs: "issuing CAs",
    summary:
      "Root → online issuing CAs. Fewer ceremonies and shorter chains; the root's key comes out for every new issuing CA.",
  },
  direct: {
    label: "Signs directly",
    signs: "leaves",
    summary:
      "The root signs leaf certificates itself, in ceremonies, generating their keys. For a consumer that requires a specific root and nothing between.",
  },
};

export const TIERS: Record<IssuerTier, string> = {
  root: "Root",
  intermediate: "Intermediate",
  issuing: "Issuing CA",
};

export const STATUS_COLORS: Record<IssuerStatus, string> = {
  pending: "default",
  active: "green",
  closed: "gold",
  revoked: "red",
};

/** Extended key usages Harpocrates's profiles use, by OID. */
export const EKU_NAMES: Record<string, string> = {
  "1.3.6.1.5.5.7.3.1": "serverAuth",
  "1.3.6.1.5.5.7.3.2": "clientAuth",
  "1.3.6.1.5.5.7.3.3": "codeSigning",
  "1.3.6.1.5.5.7.3.4": "emailProtection",
  "1.3.6.1.5.5.7.3.36": "documentSigning",
};

export const ekuName = (oid: string): string => EKU_NAMES[oid] ?? oid;

/** "20 years", "397 days": a validity as an operator thinks of it. */
export const describeDays = (days: number): string =>
  days % 365 === 0 && days >= 365
    ? `${days / 365} year${days === 365 ? "" : "s"}`
    : `${days} days`;

export const formatDate = (iso: string | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "—";

export const formatDateTime = (iso: string | undefined): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

/** Whether a CA's issuing window has closed: what it signs no longer fits. */
export const windowClosed = (issuer: { issuingWindowClosesAt?: string }) =>
  issuer.issuingWindowClosesAt !== undefined &&
  Date.parse(issuer.issuingWindowClosesAt) <= Date.now();
