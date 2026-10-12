import moment from "moment";
import type { Dashboard } from "../../model/dashboard";
import type { DashboardRow } from "../services/DashboardService";

const when = (date: Date | undefined) => (date ? moment(date) : undefined);

export const toDashboard = (row: DashboardRow): Dashboard => ({
  asOf: moment(row.asOf),
  certificates: row.certificates,
  counts: row.counts,
  health: row.health,
  renewers: {
    acme: row.renewers.acme,
    deployTarget: row.renewers["deploy-target"],
    mtls: row.renewers.mtls,
    person: row.renewers.person,
  },
  activity: row.activity,
  certificateList: row.certificateList.map((c) => ({
    certificateId: c.certificateId,
    name: c.name,
    names: c.names,
    issuerId: c.issuerId,
    profileId: c.profileId,
    profileVersion: c.profileVersion,
    serial: c.serial,
    notBefore: moment(c.notBefore),
    notAfter: moment(c.notAfter),
    issuedAt: moment(c.issuedAt),
    renewed: c.renewed,
    renewalDueAt: moment(c.renewalDueAt),
    renewal: c.renewal,
    renewer: c.renewer,
    health: c.health,
  })),
  attention: row.attention.map((a) => ({
    kind: a.kind,
    severity: a.severity,
    subjectType: a.subjectType,
    subjectId: a.subjectId,
    title: a.title,
    detail: a.detail,
    dueAt: when(a.dueAt),
  })),
  authorities: row.authorities.map((crl) => ({
    issuerId: crl.issuerId,
    tier: crl.tier,
    offline: crl.offline,
    number: crl.number?.toString(),
    nextUpdate: when(crl.nextUpdate),
    publishedAt: when(crl.publishedAt),
    ocspResponderUntil: when(crl.ocspResponderUntil),
    ocspInCeremony: crl.ocspInCeremony,
    ocspSoonestLapse: when(crl.ocspSoonestLapse),
    revoked: crl.revoked,
    valid: crl.valid,
    expired: crl.expired,
  })),
  week: row.week,
  ocsp: {
    answering: row.ocsp.answering,
    missingOnline: row.ocsp.missingOnline,
    soonestLapse: when(row.ocsp.soonestLapse),
  },
  recent: row.recent.map((event) => ({
    sequence: event.sequence.toString(),
    occurredAt: moment(event.occurredAt),
    kind: event.kind,
    principal: event.principal,
    surface: event.surface,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    subjectName: event.subjectName,
  })),
  handled: row.handled,
  ca: {
    lastPublishedAt: when(row.ca.lastPublishedAt),
    auditEvents: row.ca.auditEvents,
    lastCeremony: row.ca.lastCeremony
      ? {
          id: row.ca.lastCeremony.id,
          issuerId: row.ca.lastCeremony.issuerId,
          openedAt: moment(row.ca.lastCeremony.openedAt),
          closedAt: when(row.ca.lastCeremony.closedAt),
        }
      : undefined,
    nextCeremonyDueAt: when(row.ca.nextCeremonyDueAt),
    nextCeremonyIssuerId: row.ca.nextCeremonyIssuerId,
  },
});
