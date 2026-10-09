import type { TLSSocket } from "tls";

/** Who a verified client certificate names, or why it names no one usable. */
export type PeerCertificateIdentity =
  { name: string; deployment?: string } | { reason: string };

/**
 * The service a request's client certificate names: its common name, and
 * its organizational unit as the deployment (ADR 0018). The handshake has
 * already verified the chain and its revocation lists.
 *
 * The handshake does not establish which authority signed, only that the
 * chain reached a trusted one: the issuing CAs for services and for devices
 * are siblings under one parent, so a device certificate builds a valid
 * chain to the same root (ADR 0023). With `expectedIssuer`, the issuer's
 * common name must be that authority.
 */
export const identifyPeerCertificate = (
  socket: unknown,
  expectedIssuer?: string,
): PeerCertificateIdentity => {
  const tlsSocket = socket as Partial<TLSSocket> | undefined;
  if (typeof tlsSocket?.getPeerCertificate !== "function") {
    return { reason: "not a TLS connection" };
  }
  const certificate = tlsSocket.getPeerCertificate();
  const subject = certificate?.subject;
  const name = firstValue(subject?.CN);
  if (!name) {
    // Only reachable when the listener asks for a certificate without
    // requiring one; the handshake refuses the rest.
    return { reason: "no client certificate" };
  }

  if (expectedIssuer) {
    const issuer = firstValue(certificate?.issuer?.CN);
    if (issuer !== expectedIssuer) {
      return {
        reason: `issuer "${issuer ?? "none"}" is not "${expectedIssuer}"`,
      };
    }
  }

  return { name, deployment: firstValue(subject?.OU) };
};

/** A distinguished name's attribute is multi-valued when it is repeated. */
export const firstValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);
