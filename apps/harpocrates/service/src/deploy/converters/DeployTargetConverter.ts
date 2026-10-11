import type {
  Certificate as CertificateRow,
  Deployment as DeploymentRow,
  DeployTarget as DeployTargetRow,
  Profile,
} from "../../store/prisma";
import moment from "moment";
import type {
  Deployment,
  DeployTarget,
  FullDeployTarget,
} from "../../model/deployTargets";

const DAY = 24 * 60 * 60 * 1000;

export type DeploymentWithCertificate = DeploymentRow & {
  certificate: { serial: string };
};

export type DeployTargetWithCertificate = DeployTargetRow & {
  certificate: CertificateRow & { profile: Profile | null };
  deployments: DeploymentWithCertificate[];
};

/** Its certificate, and its deployments newest first (`take` to limit). */
export const deployTargetInclude = (take?: number) =>
  ({
    certificate: { include: { profile: true } },
    deployments: {
      include: { certificate: { select: { serial: true } } },
      orderBy: { createdAt: "desc" },
      ...(take === undefined ? {} : { take }),
    },
  }) as const;

/**
 * When Harpocrates renews a certificate: its profile's renewal age into
 * its life, or at expiry without a profile (imported: never renewed).
 */
export const renewsAt = (
  certificate: CertificateRow & { profile: Profile | null },
): Date =>
  certificate.profile
    ? new Date(
        certificate.notBefore.getTime() + certificate.profile.renewAtDays * DAY,
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

export const toDeployTarget = (
  row: DeployTargetWithCertificate,
): DeployTarget => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  certificateId: row.certificateId,
  subject: row.certificate.subject,
  notAfter: moment(row.certificate.notAfter),
  renewsAt: moment(renewsAt(row.certificate)),
  lastDeployment: row.deployments[0]
    ? toDeployment(row.deployments[0])
    : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});

export const toFullDeployTarget = (
  row: DeployTargetWithCertificate,
): FullDeployTarget => ({
  ...toDeployTarget(row),
  deployments: row.deployments.map(toDeployment),
});
