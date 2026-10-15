import {
  createSession,
  refreshTokens,
  type Session,
} from "@ncfritz/olympus-auth-flow";
import {
  AuthApi,
  AvailabilityApi,
  createOlympusClients,
} from "@ncfritz/olympus-client";

import { CLIENT_ID } from "../config";
import { formPoster } from "./signIn";
import { saveTokens } from "./storage";

/** One API, its session, and the clients that carry the session's token. */
export type Caller = {
  baseUrl: string;
  session: Session;
  auth: AuthApi;
  availability: AvailabilityApi;
};

/**
 * The session rotates the access token when it has expired, one rotation at
 * a time, and writes each rotation to the Keychain before it is used.
 */
export const createCaller = (baseUrl: string): Caller => {
  const post = formPoster(baseUrl);
  const session = createSession({
    refresh: (refreshToken) =>
      refreshTokens(post, { clientId: CLIENT_ID, refreshToken }),
    persist: (tokens) => saveTokens(baseUrl, tokens),
  });
  const clients = createOlympusClients({
    baseUrl,
    clientName: CLIENT_ID,
    auth: session.accessToken,
  });
  return {
    baseUrl,
    session,
    auth: new AuthApi(clients),
    availability: new AvailabilityApi(clients),
  };
};
