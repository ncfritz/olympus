import moment from "moment";
import type { AcmeOrderSummary } from "../../model/acme";
import type {
  AcmeAuthorization,
  AcmeChallenge,
  AcmeOrder,
} from "../../store/prisma";

export type OrderWithProgress = AcmeOrder & {
  account: { credentialId: string };
  authorizations: (AcmeAuthorization & { challenges: AcmeChallenge[] })[];
  certificate: { createdAt: Date } | null;
};

/** An order with what the console shows of it: its names, how each was proved. */
export const ORDER_INCLUDE = {
  account: { select: { credentialId: true } },
  authorizations: {
    orderBy: { identifier: "asc" },
    include: {
      challenges: {
        where: { status: { not: "pending" } },
        orderBy: { createdAt: "asc" },
      },
    },
  },
  certificate: { select: { createdAt: true } },
} as const;

const CHALLENGE_TYPE = {
  http_01: "http-01",
  tls_alpn_01: "tls-alpn-01",
} as const;

/** An ACME error type, short: without urn:ietf:params:acme:error:. */
const shortError = (type: string | null): string | undefined =>
  type ? type.replace(/^urn:ietf:params:acme:error:/, "") : undefined;

export const toAcmeOrderSummary = (
  row: OrderWithProgress,
): AcmeOrderSummary => ({
  id: row.id,
  credentialId: row.account.credentialId,
  status: row.status,
  identifiers: row.authorizations.map((a) => a.identifier),
  authorizations: row.authorizations.map((authorization) => ({
    identifier: authorization.identifier,
    status: authorization.status,
    challenges: authorization.challenges.map((challenge) => ({
      type: CHALLENGE_TYPE[challenge.type],
      status: challenge.status,
      validatedAt: challenge.validatedAt
        ? moment(challenge.validatedAt)
        : undefined,
      errorType: shortError(challenge.errorType),
      errorDetail: challenge.errorDetail ?? undefined,
      createdAt: moment(challenge.createdAt),
      updatedAt: moment(challenge.updatedAt),
    })),
    createdAt: moment(authorization.createdAt),
    updatedAt: moment(authorization.updatedAt),
  })),
  errorType: shortError(row.errorType),
  errorDetail: row.errorDetail ?? undefined,
  certificateId: row.certificateId ?? undefined,
  issuedAt: row.certificate ? moment(row.certificate.createdAt) : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});
