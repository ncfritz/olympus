import { SetMetadata } from "@nestjs/common";
import type { Request } from "express";
import type { TLSSocket } from "tls";

export const CLIENT_CERTIFICATE_KEY = "pkiClientCertificate";

/**
 * A route of the renewal listener (ADR 0020, Renewal and delivery): its
 * caller is the client certificate it presents, which the route checks
 * against Harpocrates's own records; no access token. It is served there
 * and nowhere else, and nothing else is served there.
 */
export const ClientCertificate = () =>
  SetMetadata(CLIENT_CERTIFICATE_KEY, true);

/** Which listener a request arrived on. */
export type Listener = "management" | "renewal";

type ListenerRequest = Request & { harpocratesListener?: Listener };

/** Marks a request as the renewal listener's, before the application sees it. */
export const markRenewalRequest = (request: unknown): void => {
  (request as ListenerRequest).harpocratesListener = "renewal";
};

export const listenerOf = (request: Request): Listener =>
  (request as ListenerRequest).harpocratesListener ?? "management";

/**
 * The certificate the caller presented, DER, or undefined. The renewal
 * listener asks for one and takes any: the handshake has proved the caller
 * holds its key, and the route decides whether it is one Harpocrates
 * issued and still stands behind.
 */
export const presentedCertificate = (request: Request): Buffer | undefined => {
  const socket = request.socket as Partial<TLSSocket>;
  const peer = socket.getPeerCertificate?.(false);
  return peer?.raw && peer.raw.length > 0 ? peer.raw : undefined;
};
