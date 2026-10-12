import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ISSUER_TIER_ENUM, type IssuerTierName } from "./issuers";

export const RENEWAL_MODE_VALUES = ["automatic", "manual"] as const;
export type RenewalModeName = (typeof RENEWAL_MODE_VALUES)[number];

export const RENEWAL_MODE_ENUM = {
  enum: [...RENEWAL_MODE_VALUES],
  enumName: "RenewalMode",
  enumSchema: {
    description:
      "automatic: Harpocrates or a client renews it (a deploy target's, or ACME's); manual: nothing does, a person must",
  },
};

export const ATTENTION_KIND_VALUES = [
  "certificate-due",
  "renewal-overdue",
  "deployment-failing",
  "endpoint-stale",
  "endpoint-not-stapling",
  "crl-unpublished",
  "offline-crl-due",
  "offline-ocsp-due",
  "issuing-window",
  "backup-unproved",
] as const;
export type AttentionKindName = (typeof ATTENTION_KIND_VALUES)[number];

export const ATTENTION_KIND_ENUM = {
  enum: [...ATTENTION_KIND_VALUES],
  enumName: "AttentionKind",
  enumSchema: {
    description:
      "certificate-due: past its renewal point and nothing renews it; renewal-overdue: past its renewal point though something should renew it; deployment-failing: a deployment waiting over an hour; endpoint-stale: an endpoint not serving its certificate; endpoint-not-stapling: a must-staple certificate served without stapling; crl-unpublished: a list waiting over 5 minutes to be published; offline-crl-due: an offline CA's list within 60 days of lapsing; offline-ocsp-due: an offline CA's OCSP responder within 60 days of lapsing; issuing-window: a CA within a year of no longer issuing; backup-unproved: an offline CA whose key backup is not proved",
  },
};

export const ATTENTION_SEVERITY_VALUES = ["error", "warning"] as const;
export type AttentionSeverityName = (typeof ATTENTION_SEVERITY_VALUES)[number];

export const ATTENTION_SEVERITY_ENUM = {
  enum: [...ATTENTION_SEVERITY_VALUES],
  enumName: "AttentionSeverity",
  enumSchema: {
    description:
      "error: breaks something now or within a week; warning: needs doing, not yet urgent",
  },
};

export const ATTENTION_SUBJECT_VALUES = [
  "certificate",
  "issuer",
  "deploy-target",
] as const;
export type AttentionSubjectName = (typeof ATTENTION_SUBJECT_VALUES)[number];

export const ATTENTION_SUBJECT_ENUM = {
  enum: [...ATTENTION_SUBJECT_VALUES],
  enumName: "AttentionSubject",
  enumSchema: { description: "What an attention item concerns" },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The certificates, counted. */
export class DashboardCertificates {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Valid: unexpired and not revoked",
  })
  valid: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The CAs that issued them",
  })
  issuers: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Valid, not yet replaced, and expiring within 30 days",
  })
  dueWithin30Days: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of those, how many nothing renews: a person must",
  })
  dueManual: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Expired in the last 30 days without being replaced or revoked",
  })
  expiredRecently: number;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "Their common names, soonest expired first, at most 3",
  })
  expiredNames: string[];

  @ApiProperty({
    type: Number,
    required: true,
    description: "Revoked and not yet expired",
  })
  revoked: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Revoked in the last 7 days",
  })
  revokedThisWeek: number;
}

/**
 * A certificate expiring within 90 days that nothing has replaced yet: no
 * renewal of it, and no later certificate from its CA for its subject (an
 * ACME client's next order).
 */
export class ExpiringCertificate {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  certificateId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its common name, or its subject when it has none",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA that issued it",
  })
  issuerId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The profile it was issued under",
  })
  profileId?: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it expires",
  })
  notAfter: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: its renewal point, from its profile version (30 days before expiry without one)",
  })
  renewalDueAt: Moment;

  @ApiProperty({
    ...RENEWAL_MODE_ENUM,
    required: true,
    description: "Whether something renews it",
  })
  renewal: RenewalModeName;
}

/** Something a person should do, soonest and worst first. */
export class AttentionItem {
  @ApiProperty({
    ...ATTENTION_KIND_ENUM,
    required: true,
    description: "What it is",
  })
  kind: AttentionKindName;

  @ApiProperty({
    ...ATTENTION_SEVERITY_ENUM,
    required: true,
    description: "How urgent",
  })
  severity: AttentionSeverityName;

  @ApiProperty({
    ...ATTENTION_SUBJECT_ENUM,
    required: true,
    description: "What it concerns",
  })
  subjectType: AttentionSubjectName;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its ID: a certificate's, a CA's or a deploy target's",
  })
  subjectId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What it concerns, by name",
  })
  title: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What is wrong and what to do",
  })
  detail: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when it breaks if nothing is done",
  })
  dueAt?: Moment;
}

/** A CA's newest revocation list. */
export class DashboardCrl {
  @ApiProperty({ type: String, required: true, description: "The CA" })
  issuerId: string;

  @ApiProperty({
    ...ISSUER_TIER_ENUM,
    required: true,
    description: "Its tier",
  })
  tier: IssuerTierName;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether its key is offline: its lists are signed in ceremonies",
  })
  offline: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its newest list's number; none when it has none",
  })
  number?: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when its newest published list lapses",
  })
  nextUpdate?: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when its newest list was published; none while it waits",
  })
  publishedAt?: Moment;
}

/** What the CA did in the last 7 days. */
export class DashboardWeek {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Certificates issued, renewals and ACME's included",
  })
  issued: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of those, renewals of a certificate it names",
  })
  renewals: number;

  @ApiProperty({ type: Number, required: true, description: "ACME orders" })
  acmeOrders: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "ACME orders that failed",
  })
  acmeOrdersFailed: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Certificates deployed to deploy targets",
  })
  deployed: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Deployments still failing",
  })
  deploymentsFailing: number;
}

/** A ceremony, briefly. */
export class DashboardCeremony {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({ type: String, required: true, description: "Its CA" })
  issuerId: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it opened",
  })
  openedAt: Moment;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it closed",
  })
  closedAt?: Moment;
}

/** The CA itself. */
export class DashboardCa {
  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when a list was last published",
  })
  lastPublishedAt?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Events in the audit log",
  })
  auditEvents: number;

  @ApiProperty({
    type: () => DashboardCeremony,
    required: false,
    description: "The newest ceremony",
  })
  lastCeremony?: DashboardCeremony;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when an offline CA's list or OCSP responder next lapses, which a ceremony renews",
  })
  nextCeremonyDueAt?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "The offline CA it is for",
  })
  nextCeremonyIssuerId?: string;
}

/** The CA at a glance. */
export class Dashboard {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was read",
  })
  asOf: Moment;

  @ApiProperty({
    type: () => DashboardCertificates,
    required: true,
    description: "The certificates, counted",
  })
  certificates: DashboardCertificates;

  @ApiProperty({
    type: () => ExpiringCertificate,
    isArray: true,
    required: true,
    description:
      "Valid certificates expiring within 90 days that nothing has replaced yet, soonest first",
  })
  expiring: ExpiringCertificate[];

  @ApiProperty({
    type: () => AttentionItem,
    isArray: true,
    required: true,
    description: "What needs a person, errors first, then soonest first",
  })
  attention: AttentionItem[];

  @ApiProperty({
    type: () => DashboardCrl,
    isArray: true,
    required: true,
    description: "Each active CA's newest revocation list, online CAs first",
  })
  crls: DashboardCrl[];

  @ApiProperty({
    type: () => DashboardWeek,
    required: true,
    description: "The last 7 days",
  })
  week: DashboardWeek;

  @ApiProperty({
    type: () => DashboardCa,
    required: true,
    description: "The CA itself",
  })
  ca: DashboardCa;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetDashboardResponse {
  @ApiProperty({
    type: () => Dashboard,
    required: true,
    description: "The dashboard",
  })
  dashboard: Dashboard;
}
