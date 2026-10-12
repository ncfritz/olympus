import { applyDecorators, SetMetadata } from "@nestjs/common";
import { Public } from "./public";
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

export const SIGNED_RENEWAL_KEY = "pkiSignedRenewal";

/**
 * A route of the renewal listener whose request proves itself (ADR 0035):
 * an SSH host renewing signs a challenge with its host key; no client
 * certificate, no access token (so @Public(), as ACME's routes are).
 * Served there and nowhere else.
 */
export const SignedRenewal = () =>
  applyDecorators(SetMetadata(SIGNED_RENEWAL_KEY, true), Public());

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
