import type {
  CertificateHealthName,
  RenewalModeName,
  RenewerName,
} from "../model/dashboard";
import type { PrismaService } from "../store/PrismaService";

const DAY = 24 * 60 * 60 * 1000;

/** Without a profile version, a certificate is due this long before expiry. */
export const DEFAULT_RENEWAL_DAYS = 30;

/** A renewal that has not happened within this of expiry is failing. */
export const URGENT_DAYS = 7;

/**
 * How a certificate is renewed (the dashboard's and the certificates
 * list's reading): who renews it, when it is due, and whether that is in
 * hand.
 */

/** The certificates among these issued as a renewal over mTLS. */
export const renewedOverMtls = async (
  prisma: PrismaService,
  certificateIds: string[],
): Promise<Set<string>> =>
  new Set(
    (
      await prisma.auditEvent.findMany({
        where: {
          kind: "certificate.renewed",
          surface: "renewal",
          subjectType: "certificate",
          subjectId: { in: certificateIds },
        },
        select: { subjectId: true },
      })
    ).flatMap((event) => (event.subjectId ? [event.subjectId] : [])),
  );

/**
 * Who renews a certificate: the ACME client that ordered it, the deploy
 * target it is deployed to, its holder over mTLS, or a person.
 */
export const renewerOf = (
  certificate: {
    id: string;
    acmeOrder: { id: string } | null;
    deployTargets: unknown[];
  },
  overMtls: Set<string>,
): RenewerName =>
  certificate.acmeOrder
    ? "acme"
    : certificate.deployTargets.length > 0
      ? "deploy-target"
      : overMtls.has(certificate.id)
        ? "mtls"
        : "person";

/** Its renewal point: its profile version's, or 30 days before expiry. */
export const renewalDueAt = (
  notAfter: Date,
  version: { validityDays: number; renewAtDays: number } | null | undefined,
): Date =>
  new Date(
    notAfter.getTime() -
      (version
        ? version.validityDays - version.renewAtDays
        : DEFAULT_RENEWAL_DAYS) *
        DAY,
  );

/**
 * Whether its renewal is in hand: healthy before its renewal point; past
 * it, a person's to do when nothing renews it, else renewing, and failing
 * within a week of expiry; expired after.
 */
export const healthOf = (
  notAfter: Date,
  dueAt: Date,
  renewal: RenewalModeName,
  now: Date,
): CertificateHealthName =>
  notAfter <= now
    ? "expired"
    : dueAt > now
      ? "healthy"
      : renewal === "manual"
        ? "needs-person"
        : notAfter.getTime() - now.getTime() <= URGENT_DAYS * DAY
          ? "failing"
          : "renewing";
