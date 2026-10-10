import {
  clearSessionCookies as clearShared,
  type SessionCookieConfig,
  sessionCookieOptions,
  sessionCookiePath,
  type SessionTokens,
  setSessionCookies as setShared,
} from "@ncfritz/olympus-nest";
import type { Response } from "express";
import { COOKIE_PREFIX } from "./authConstants";

/**
 * The session cookies are `@ncfritz/olympus-nest`'s (ADR 0029, shared with
 * Harpocrates's console); these keep the agent's names for them, with its
 * cookie prefix.
 */
export {
  type SessionCookieConfig,
  sessionCookieOptions,
  sessionCookiePath,
  type SessionTokens,
};

/** Both session cookies, from a sign-in or a refresh. */
export const setSessionCookies = (
  response: Response,
  auth: SessionCookieConfig,
  tokens: SessionTokens,
): void =>
  setShared(response, { ...auth, cookiePrefix: COOKIE_PREFIX }, tokens);

/** Both session cookies gone: signed out, or a session the API ended. */
export const clearSessionCookies = (
  response: Response,
  auth: SessionCookieConfig,
): void => clearShared(response, { ...auth, cookiePrefix: COOKIE_PREFIX });
