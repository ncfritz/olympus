import {
  consoleApiPath,
  createConsoleClient,
  type ConsoleKey,
} from "@ncfritz/olympus-console";
import type { paths } from "../../generated/api";

/** This console, in the suite (ADR 0021). */
export const CONSOLE_KEY: ConsoleKey = "harpocrates/ca";

/** Where this console is published: `/harpocrates/ca`, or the root in the workspace. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * The Harpocrates service, which nginx publishes under this console on the
 * control host. The workspace overrides it with NEXT_PUBLIC_API_URL, where
 * the service is a port of its own.
 *
 * `||`, not `??`: the image's build stage sets these to the empty string
 * when they are not given, and Next inlines that rather than `undefined`.
 */
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || undefined;

export const API_URL = configuredApiUrl ?? consoleApiPath(CONSOLE_KEY);

/**
 * Every request rides on the httpOnly cookies the service's
 * /auth/callback sets (ADR 0029, 0032): this app never sees a token.
 */
export const apiClient = createConsoleClient<paths>({
  key: CONSOLE_KEY,
  baseUrl: configuredApiUrl,
});

/** Signing in again, back to this page: what a recent sign-in needs. */
export const signInAgainHref = (): string => {
  const here = typeof window === "undefined" ? "" : window.location.href;
  return `${API_URL}/auth/login/google?returnTo=${encodeURIComponent(here)}`;
};
