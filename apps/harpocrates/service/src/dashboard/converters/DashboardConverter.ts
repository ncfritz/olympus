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
  expiring: row.expiring.map((e) => ({
    certificateId: e.certificateId,
    name: e.name,
    issuerId: e.issuerId,
    profileId: e.profileId,
    notAfter: moment(e.notAfter),
    renewalDueAt: moment(e.renewalDueAt),
    renewal: e.renewal,
    renewer: e.renewer,
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
  crls: row.crls.map((crl) => ({
    issuerId: crl.issuerId,
    tier: crl.tier,
    offline: crl.offline,
    number: crl.number?.toString(),
    nextUpdate: when(crl.nextUpdate),
    publishedAt: when(crl.publishedAt),
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
