import {
  client,
  describeCurrentUser,
  listSessions,
  revokeSession,
  signOut,
} from "@ncfritz/olympus-sdk/olympus";

/**
 * The endpoints that answer about the signed-in caller (ADR 0018).
 *
 * The token endpoint is deliberately not here: it issues an access token, so it
 * cannot carry one, and it is the one call that must not go through the client
 * the interceptors are attached to. `src/auth/tokenEndpoint.ts` speaks to it.
 */
class AuthApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async describeCurrentUser() {
    return await describeCurrentUser();
  }

  /** Ends this browser's session, and clears the refresh cookie with it. */
  async signOut() {
    return await signOut();
  }

  async listSessions() {
    return await listSessions();
  }

  async revokeSession(sessionId: string) {
    return await revokeSession({ path: { sessionId } });
  }
}

export default new AuthApi();
