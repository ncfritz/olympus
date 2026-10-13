const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** What a certificate's renewal window is worked out from. */
export type RenewalWindowInput = {
  status: string;
  notBefore: Date;
  notAfter: Date;
  /** Its profile version's renewal age, if it was issued under one. */
  renewAtDays?: number;
};

/**
 * When a certificate should be renewed, as ACME Renewal Information
 * (RFC 9773) suggests it: from its profile's renewal age (or two thirds
 * of its life) to half-way to its expiry; for a revoked one, a window
 * already past, so its client renews now. Milliseconds since the epoch.
 */
export const renewalWindowOf = (
  certificate: RenewalWindowInput,
  now: number,
): { start: number; end: number } => {
  if (certificate.status === "revoked") {
    return { start: now - 2 * HOUR, end: now - HOUR };
  }
  const notBefore = certificate.notBefore.getTime();
  const notAfter = certificate.notAfter.getTime();
  const start =
    certificate.renewAtDays !== undefined
      ? Math.min(notBefore + certificate.renewAtDays * DAY, notAfter)
      : notBefore + ((notAfter - notBefore) * 2) / 3;
  return { start, end: start + (notAfter - start) / 2 };
};
