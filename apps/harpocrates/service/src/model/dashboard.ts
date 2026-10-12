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

export const RENEWER_VALUES = [
  "acme",
  "deploy-target",
  "mtls",
  "person",
] as const;
export type RenewerName = (typeof RENEWER_VALUES)[number];

export const RENEWER_ENUM = {
  enum: [...RENEWER_VALUES],
  enumName: "Renewer",
  enumSchema: {
    description:
      "acme: its ACME client orders the next; deploy-target: Harpocrates renews and deploys it; mtls: its holder renews it over mutual TLS, as it did to get it; person: nothing does",
  },
};

export const CERTIFICATE_HEALTH_VALUES = [
  "healthy",
  "renewing",
  "needs-person",
  "failing",
  "expired",
] as const;
export type CertificateHealthName = (typeof CERTIFICATE_HEALTH_VALUES)[number];

export const CERTIFICATE_HEALTH_ENUM = {
  enum: [...CERTIFICATE_HEALTH_VALUES],
  enumName: "CertificateHealth",
  enumSchema: {
    description:
      "healthy: not yet at its renewal point; renewing: past it, something renews it, more than a week left; failing: the same with a week or less; needs-person: past it, nothing renews it; expired: expired without being replaced",
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
 * A certificate nothing has replaced (no renewal of it, and no later one
 * from its CA for its subject, as an ACME client's next order is): valid,
 * or expired within the last year.
 */
export class DashboardCertificate {
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
    isArray: true,
    required: true,
    description: "Its alternative names' values",
  })
  names: string[];

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

  @ApiProperty({
    type: Number,
    required: false,
    description: "The profile's version it was issued under",
  })
  profileVersion?: number;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its serial, hex",
  })
  serial: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it becomes valid",
  })
  notBefore: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it expires",
  })
  notAfter: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was issued",
  })
  issuedAt: Moment;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether it was issued as a renewal, or for a subject its CA had issued for before",
  })
  renewed: boolean;

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

  @ApiProperty({
    ...RENEWER_ENUM,
    required: true,
    description: "Who renews it",
  })
  renewer: RenewerName;

  @ApiProperty({
    ...CERTIFICATE_HEALTH_ENUM,
    required: true,
    description: "Whether its renewal is in hand",
  })
  health: CertificateHealthName;
}

/** The headline counts beyond the certificates'. */
export class DashboardCounts {
  @ApiProperty({
    type: Number,
    required: true,
    description: "CAs in service: active or closed, with a certificate",
  })
  cas: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Of those, roots and intermediates: offline",
  })
  offlineCas: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Valid SSH certificates",
  })
  sshValid: number;

  @ApiProperty({ type: Number, required: true, description: "Of those, user" })
  sshUser: number;

  @ApiProperty({ type: Number, required: true, description: "Of those, host" })
  sshHost: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Active profiles, X.509 and SSH",
  })
  profiles: number;
}

/**
 * Valid certificates nothing has replaced, by whether their renewal is in
 * hand: healthy (before its renewal point), renewing (past it, something
 * renews it, more than a week left), failing (the same, a week or less
 * left), needs a person (past it, nothing renews it).
 */
export class RenewalHealth {
  @ApiProperty({ type: Number, required: true, description: "Healthy" })
  healthy: number;

  @ApiProperty({ type: Number, required: true, description: "Renewing" })
  renewing: number;

  @ApiProperty({ type: Number, required: true, description: "Needs a person" })
  needsPerson: number;

  @ApiProperty({ type: Number, required: true, description: "Failing" })
  failing: number;
}

/** Valid certificates nothing has replaced, by who renews them. */
export class RenewerCounts {
  @ApiProperty({ type: Number, required: true, description: "ACME clients" })
  acme: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Harpocrates, to deploy targets",
  })
  deployTarget: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Their holders, over mutual TLS",
  })
  mtls: number;

  @ApiProperty({ type: Number, required: true, description: "A person" })
  person: number;
}

/** One day's certificates: issued, renewed and revoked. */
export class ActivityDay {
  @ApiProperty({
    type: String,
    required: true,
    description: "The day, YYYY-MM-DD, UTC",
  })
  day: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Issued, not as a renewal",
  })
  issued: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Issued as a renewal, or for a subject its CA had issued for before",
  })
  renewed: number;

  @ApiProperty({ type: Number, required: true, description: "Revoked" })
  revoked: number;
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

/** A CA in service: its newest revocation list and its OCSP. */
export class DashboardAuthority {
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

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when its OCSP responder in service lapses; none without one",
  })
  ocspResponderUntil?: Moment;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether that responder was issued in a ceremony",
  })
  ocspInCeremony?: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when its soonest stored OCSP response lapses",
  })
  ocspSoonestLapse?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its certificates revoked and not yet expired",
  })
  revoked: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its certificates valid now: neither revoked nor expired",
  })
  valid: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its certificates expired, unrevoked, ever",
  })
  expired: number;
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

/** A recent audit event, with what it concerns by name. */
export class DashboardEvent {
  @ApiProperty({
    type: String,
    required: true,
    description: "Its position in the audit chain",
  })
  sequence: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it happened",
  })
  occurredAt: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "What happened, e.g. certificate.issued",
  })
  kind: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Who: user:<email>, cli:<name>, acme:<account> or system",
  })
  principal: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where from: api, cli, acme, renewal or system",
  })
  surface: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The kind of thing it concerns",
  })
  subjectType?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its ID",
  })
  subjectId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Its name: a certificate's or CA's common name, a deploy target's name",
  })
  subjectName?: string;
}

/** Work done in the last 7 days without a person: by ACME, renewal or the service. */
export class HandledCount {
  @ApiProperty({
    type: String,
    required: true,
    description: "The audit kind, e.g. certificate.renewed",
  })
  kind: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where from: acme, renewal or system",
  })
  surface: string;

  @ApiProperty({ type: Number, required: true, description: "How many" })
  count: number;
}

/** OCSP across the CAs (ADR 0036). */
export class DashboardOcsp {
  @ApiProperty({
    type: Number,
    required: true,
    description: "CAs with a responder in service",
  })
  answering: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Active online CAs with none: the service issues theirs on its next run",
  })
  missingOnline: number;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when the soonest stored response lapses",
  })
  soonestLapse?: Moment;
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
    type: () => DashboardCounts,
    required: true,
    description: "The headline counts beyond the certificates'",
  })
  counts: DashboardCounts;

  @ApiProperty({
    type: () => RenewalHealth,
    required: true,
    description: "Valid certificates by whether their renewal is in hand",
  })
  health: RenewalHealth;

  @ApiProperty({
    type: () => RenewerCounts,
    required: true,
    description: "Valid certificates by who renews them",
  })
  renewers: RenewerCounts;

  @ApiProperty({
    type: () => ActivityDay,
    isArray: true,
    required: true,
    description: "Each of the last 90 days (UTC), oldest first",
  })
  activity: ActivityDay[];

  @ApiProperty({
    type: () => DashboardCertificate,
    isArray: true,
    required: true,
    description:
      "Certificates nothing has replaced, valid or expired within the last year, soonest to expire first",
  })
  certificateList: DashboardCertificate[];

  @ApiProperty({
    type: () => AttentionItem,
    isArray: true,
    required: true,
    description: "What needs a person, errors first, then soonest first",
  })
  attention: AttentionItem[];

  @ApiProperty({
    type: () => DashboardAuthority,
    isArray: true,
    required: true,
    description:
      "Each CA in service: its newest revocation list and its OCSP, online CAs first",
  })
  authorities: DashboardAuthority[];

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

  @ApiProperty({
    type: () => DashboardOcsp,
    required: true,
    description: "OCSP across the CAs",
  })
  ocsp: DashboardOcsp;

  @ApiProperty({
    type: () => DashboardEvent,
    isArray: true,
    required: true,
    description: "The latest audit events, newest first",
  })
  recent: DashboardEvent[];

  @ApiProperty({
    type: () => HandledCount,
    isArray: true,
    required: true,
    description:
      "What ACME, renewal and the service did in the last 7 days, by audit kind and surface",
  })
  handled: HandledCount[];
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
