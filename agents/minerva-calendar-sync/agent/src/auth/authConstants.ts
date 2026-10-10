import { sessionCookieNames } from "@ncfritz/olympus-nest";

/** The prefix of this console's cookies (ADR 0029). */
export const COOKIE_PREFIX = "minerva";

const COOKIES = sessionCookieNames({ cookiePrefix: COOKIE_PREFIX });

/**
 * httpOnly cookie the console's browser session rides on: an Olympus access
 * token (ADR 0029). Callers without a browser send it as a Bearer header.
 */
export const ACCESS_TOKEN_COOKIE = COOKIES.access;

/**
 * httpOnly cookie holding the Olympus refresh token: the API hands this
 * client its refresh token in the body (ADR 0029), and the agent keeps it
 * where no script can read it.
 */
export const REFRESH_TOKEN_COOKIE = COOKIES.refresh;

/** Short-lived cookie holding the in-flight sign-in (state, PKCE verifier) between login and callback. */
export const SIGN_IN_TXN_COOKIE = COOKIES.signIn;

/** This console, as the API's client registry knows it (ADR 0029). */
export const OLYMPUS_CLIENT_ID = "minerva-calendar-console";

/** What the API's session list calls this console's sessions. */
export const DEVICE_NAME = "Minerva calendar console";

/** The role the agent requires of a person (ADR 0029). */
export const REQUIRED_ROLE = "admin";
