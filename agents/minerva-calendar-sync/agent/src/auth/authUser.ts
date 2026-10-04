import type { Request } from "express";

/**
 * A person signed in through Olympus (ADR 0029), named by their Olympus
 * user ID. The access token they presented, or the one the agent just
 * refreshed for them, rides along: the console's availability is theirs,
 * so the API is asked with it.
 */
export interface AuthUser {
  kind: "user";
  userId: string;
  roles: string[];
  accessToken: string;
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
