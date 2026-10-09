import { Counter, register } from "prom-client";

/**
 * The CA's counters (ADR 0020, Monitoring). Module-level, on the default
 * registry, once per process: tests create many applications.
 */
const counter = (name: string, help: string, labelNames: string[]) =>
  (register.getSingleMetric(name) as Counter<string> | undefined) ??
  new Counter({ name, help, labelNames });

export const certificatesIssued = counter(
  "harpocrates_certificates_issued_total",
  "Certificates issued, by issuer and profile (renewals included)",
  ["issuer", "profile"],
);

export const revocations = counter(
  "harpocrates_revocations_total",
  "Certificates revoked, by issuer and reason",
  ["issuer", "reason"],
);

export const refusals = counter(
  "harpocrates_refusals_total",
  "Requests refused by a profile rule or a signer invariant",
  ["invariant"],
);

export const crlsSigned = counter(
  "harpocrates_crls_signed_total",
  "Revocation lists signed or imported, by issuer and source",
  ["issuer", "source"],
);

export const crlSigningFailures = counter(
  "harpocrates_crl_signing_failures_total",
  "Scheduled list signings that failed, by issuer and reason (sealed, refused, error)",
  ["issuer", "reason"],
);

export const crlPublicationFailures = counter(
  "harpocrates_crl_publication_failures_total",
  "Attempts to publish a list that failed: written, or read back from the distribution URL",
  ["issuer"],
);
