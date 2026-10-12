import type {
  Certificate as CertificateRow,
  Deployment as DeploymentRow,
  DeployTarget as DeployTargetRow,
  EndpointObservation as ObservationRow,
  ProfileVersion,
} from "../../store/prisma";
import moment from "moment";
import type {
  Deployment,
  DeployTarget,
  EndpointObservation,
  FullDeployTarget,
} from "../../model/deployTargets";

const DAY = 24 * 60 * 60 * 1000;

export type DeploymentWithCertificate = DeploymentRow & {
  certificate: { serial: string };
};

export type DeployTargetWithCertificate = DeployTargetRow & {
  certificate: CertificateRow & { profileVersion: ProfileVersion | null };
  deployments: DeploymentWithCertificate[];
  observations: ObservationRow[];
};

/** Its certificate, and its deployments newest first (`take` to limit). */
export const deployTargetInclude = (take?: number) =>
  ({
    certificate: { include: { profileVersion: true } },
    deployments: {
      include: { certificate: { select: { serial: true } } },
      orderBy: { createdAt: "desc" },
      ...(take === undefined ? {} : { take }),
    },
    observations: {
      orderBy: { updatedAt: "desc" },
      ...(take === undefined ? {} : { take }),
    },
  }) as const;

/**
 * When Harpocrates renews a certificate: the renewal age of the profile
 * version it was issued under into its life, or at expiry without one
 * (imported: never renewed).
 */
export const renewsAt = (
  certificate: CertificateRow & { profileVersion: ProfileVersion | null },
): Date =>
  certificate.profileVersion
    ? new Date(
        certificate.notBefore.getTime() +
          certificate.profileVersion.renewAtDays * DAY,
      )
    : certificate.notAfter;

export const toDeployment = (row: DeploymentWithCertificate): Deployment => ({
  id: row.id,
  certificateId: row.certificateId,
  serial: row.certificate.serial,
  status: row.status,
  principal: row.principal,
  attempts: row.attempts,
  lastAttemptAt: row.lastAttemptAt ? moment(row.lastAttemptAt) : undefined,
  lastError: row.lastError ?? undefined,
  deployedAt: row.deployedAt ? moment(row.deployedAt) : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});

export const toObservation = (row: ObservationRow): EndpointObservation => ({
  id: row.id,
  endpoint: row.endpoint,
  result: row.result,
  expectedCertificateId: row.expectedCertificateId,
  servedCertificateId: row.servedCertificateId ?? undefined,
  servedSha256: row.servedSha256 ?? undefined,
  servedSerial: row.servedSerial ?? undefined,
  servedSubject: row.servedSubject ?? undefined,
  servedNotAfter: row.servedNotAfter ? moment(row.servedNotAfter) : undefined,
  servedMustStaple: row.servedMustStaple ?? undefined,
  stapled: row.stapled ?? undefined,
  error: row.error ?? undefined,
  checks: row.checks,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});

export const toDeployTarget = (
  row: DeployTargetWithCertificate,
): DeployTarget => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  certificateId: row.certificateId,
  endpoint: row.endpoint,
  subject: row.certificate.subject,
  notAfter: moment(row.certificate.notAfter),
  renewsAt: moment(renewsAt(row.certificate)),
  lastDeployment: row.deployments[0]
    ? toDeployment(row.deployments[0])
    : undefined,
  lastObservation: row.observations[0]
    ? toObservation(row.observations[0])
    : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});

export const toFullDeployTarget = (
  row: DeployTargetWithCertificate,
): FullDeployTarget => ({
  ...toDeployTarget(row),
  deployments: row.deployments.map(toDeployment),
  observations: row.observations.map(toObservation),
});
