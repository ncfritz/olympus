import {
  describeCurrentUser,
  listSessions,
  revokeSession,
  signOut,
} from "@ncfritz/olympus-sdk/olympus";
import type { OlympusClients } from "../clients";

/**
 * The signed-in user's own account and sessions (ADR 0018).
 *
 * Every method here answers about whoever the access token belongs to. None
 * of them takes a user: the endpoints read `sub` from the token, so there is
 * no version of these calls that asks about somebody else. The clients this
 * is built with therefore need `auth` -- without it these are 401s.
 */
export class AuthApi {
  constructor(private readonly clients: OlympusClients) {}

  /** The caller, with the roles the directory holds now, not the token's. */
  async describeCurrentUser() {
    const response = await describeCurrentUser({
      client: this.clients.olympus,
    });
    return response.data.user;
  }

  /** Every session the caller is signed in on, newest first. */
  async listSessions() {
    const response = await listSessions({ client: this.clients.olympus });
    return response.data.sessions;
  }

  /**
   * Ends one of the caller's sessions. A session that is not theirs answers
   * 404 exactly as one that does not exist, so a throw here says nothing
   * about whether the id belongs to anyone.
   */
  async revokeSession(sessionId: string) {
    const response = await revokeSession({
      client: this.clients.olympus,
      path: { sessionId },
    });
    return response.data;
  }

  /**
   * Ends the session this call is made from, and clears the refresh cookie
   * of a client that keeps one there.
   */
  async signOut() {
    const response = await signOut({ client: this.clients.olympus });
    return response.data;
  }
}
