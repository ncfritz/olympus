import type {
  Deployment,
  EndpointObservation,
  IssuedTier,
  IssuerShape,
  IssuerStatus,
  IssuerTier,
} from "./api/types";

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

/** Where in a CA's hierarchy a certificate is, as the chart names it. */
export const ISSUED_TIERS: Record<IssuedTier, string> = {
  intermediate: "Intermediate CAs",
  issuing: "Issuing CAs",
  leaf: "Leaf certificates",
};

/** The seeded profiles, as kinds of leaf. */
const LEAF_TYPES: Record<string, string> = {
  "internal-tls": "TLS",
  "api-server": "API server",
  service: "Service",
  device: "Device",
  "legacy-device": "Legacy device",
  "code-signing": "Code signing",
  email: "Email",
  document: "Document signing",
  "direct-minimal": "Direct",
  other: "Other",
};

/** A count's type, named: a CA's purpose, or a leaf's profile. */
export const issuedTypeName = ({
  tier,
  type,
}: {
  tier: IssuedTier;
  type: string;
}): string =>
  tier === "leaf"
    ? (LEAF_TYPES[type] ?? type)
    : type === "general"
      ? "General"
      : type;

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

/**
 * A deployment as the console shows it: a pending one that has failed is
 * failing, and retried by the service until it succeeds.
 */
export const deploymentState = (
  deployment: Deployment | undefined,
): { label: string; color: string } => {
  if (!deployment) return { label: "Never deployed", color: "default" };
  switch (deployment.status) {
    case "deployed":
      return { label: "Deployed", color: "green" };
    case "superseded":
      return { label: "Superseded", color: "default" };
    default:
      return deployment.lastError
        ? { label: "Failing", color: "red" }
        : { label: "Pending", color: "blue" };
  }
};

/** What a target's endpoint served when last checked, as the console says it. */
export const servingState = (
  observation: EndpointObservation | undefined,
): { label: string; color: string; detail?: string } => {
  if (!observation) return { label: "Not checked", color: "default" };
  switch (observation.result) {
    case "current":
      return {
        label: "Serving it",
        color: "green",
        detail: `Serial ${observation.servedSerial}`,
      };
    case "previous":
      return {
        label: "Old certificate",
        color: "gold",
        detail: `Serial ${observation.servedSerial}, deployed here before: nginx has not reloaded`,
      };
    case "other":
      return {
        label: "Another certificate",
        color: "red",
        detail: `${observation.servedSubject ?? "Unreadable"}, serial ${observation.servedSerial ?? "unknown"}: never deployed here`,
      };
    default:
      return {
        label: "Unreachable",
        color: "red",
        detail: observation.error,
      };
  }
};
