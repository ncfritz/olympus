import type { Request } from "express";

/**
 * Who a request is from (ADR 0018). The API only ever sets this from
 * something it verified itself: a certificate chain on the services
 * listener, a token signature on the users listener.
 */
export type Principal = UserPrincipal | ServicePrincipal;

export interface UserPrincipal {
  kind: "user";
  userId: string;
  roles: string[];
  /** The client the token was issued to, e.g. olympus-site. */
  client: string;
  /** The session the token was issued from (`sid`). */
  sessionId: string;
}

export interface ServicePrincipal {
  kind: "service";
  /** The certificate's common name, e.g. dionysus-asset-agent. */
  name: string;
  /** Its organizational unit: where the service runs (prod, nas). */
  deployment?: string;
  roles: string[];
}

/** Which listener a request arrived on: they authenticate differently. */
export type Listener = "users" | "services";

export type AuthOutcome = "allow" | "reject" | "would_reject";

export type RequestWithPrincipal = Request & {
  listener?: Listener;
  principal?: Principal;
};

/** The name a request's principal is known by, for logs and metrics. */
export const principalName = (principal: Principal | undefined): string =>
  principal === undefined
    ? "anonymous"
    : principal.kind === "user"
      ? `user/${principal.userId}`
      : `service/${principal.name}`;
