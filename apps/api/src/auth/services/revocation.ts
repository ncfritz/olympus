/**
 * Whether the services listener has the revocation lists it needs.
 *
 * Node checks a client's certificate chain against a CRL from **every**
 * authority in it (OpenSSL's `X509_V_FLAG_CRL_CHECK_ALL`), so a chain of three
 * authorities needs three lists. One missing list refuses every client
 * certificate during the handshake.
 *
 * That failure is close to undiagnosable from the outside, which is why it is
 * checked at startup rather than left to be discovered: under TLS 1.3 the
 * client's handshake completes before the server has validated the client's
 * certificate, so the caller sees the connection drop with no alert, the
 * server reports the caller hanging up, and neither end says a word about a
 * CRL. `openssl verify -crl_check_all` does -- and is the only thing that
 * does.
 */
export type RevocationCoverage = {
  /** Certificates in TLS_CA_SERVICES: the authorities a chain can name. */
  authorities: number;
  /** Lists Node will actually use: one per file, however many a file holds. */
  lists: number;
  /** Files holding more than one list, whose extras are silently ignored. */
  bundled: number;
};

const occurrences = (pem: string, marker: string): number =>
  pem.split(`-----BEGIN ${marker}-----`).length - 1;

export const revocationCoverage = (
  caPem: string,
  crlPems: string[],
): RevocationCoverage => ({
  authorities: occurrences(caPem, "CERTIFICATE"),
  lists: crlPems.length,
  bundled: crlPems.filter((pem) => occurrences(pem, "X509 CRL") > 1).length,
});

/** What to say about it, if anything: one sentence per fault, for the log. */
export const revocationWarnings = (coverage: RevocationCoverage): string[] => {
  const warnings: string[] = [];
  if (coverage.lists < coverage.authorities) {
    warnings.push(
      `TLS_CA_SERVICES holds ${coverage.authorities} authorities and TLS_CRL_SERVICES names ${coverage.lists} revocation lists. A chain is checked against a list from every authority in it, so every client certificate will be refused during the handshake -- with no reason given to either end.`,
    );
  }
  if (coverage.bundled > 0) {
    warnings.push(
      `${coverage.bundled} of the revocation-list files holds more than one list. Node reads only the first in a file, so the rest are ignored: name each list as its own path.`,
    );
  }
  return warnings;
};
