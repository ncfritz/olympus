import type { Request } from "express";

/** A person signed in through the console's OIDC sign-in. */
export interface AuthUser {
  kind: "user";
  email: string;
}

/**
 * A service on the services listener, named by its verified client
 * certificate: the Olympus API (ADR 0028).
 */
export interface AuthService {
  kind: "service";
  name: string;
}

export type AuthCaller = AuthUser | AuthService;

/** Which listener a request arrived on: set by the services listener. */
export type Listener = "http" | "services";

export interface AuthenticatedRequest extends Request {
  user: AuthCaller;
  listener?: Listener;
}
