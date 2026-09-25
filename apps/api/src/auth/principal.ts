import { UnauthorizedException } from "@nestjs/common";
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

/**
 * The user a request is from, for a route that cannot be served without
 * one.
 *
 * The guard has already refused a request with no principal on any route
 * marked `@RequiresIdentity()`, so this throws only where that was
 * forgotten -- which is exactly why it throws rather than asserting the
 * type away. A service principal reaching a user route is the other case:
 * a certificate on the services listener is not a person, and it has no
 * sessions and no email to describe.
 */
export const requireUser = (
  principal: Principal | undefined,
): UserPrincipal => {
  if (principal?.kind !== "user") {
    throw new UnauthorizedException();
  }
  return principal;
};

/** The name a request's principal is known by, for logs and metrics. */
export const principalName = (principal: Principal | undefined): string =>
  principal === undefined
    ? "anonymous"
    : principal.kind === "user"
      ? `user/${principal.userId}`
      : `service/${principal.name}`;
