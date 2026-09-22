import {
  consoleApiPath,
  createConsoleClient,
  type ConsoleKey,
} from "@ncfritz/olympus-console";
import type { paths } from "../../generated/api";

/** This console, in the suite (ADR 0021). */
export const CONSOLE_KEY: ConsoleKey = "minerva/calendar";

/** Where this console is published: `/minerva/calendar`, or the root in the workspace. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * The agent, which nginx publishes under this console on the control
 * host. The workspace overrides it with NEXT_PUBLIC_API_URL, where the
 * agent is a port of its own.
 */
// `||`, not `??`: the image's build stage sets these to the empty string
// when they are not given, and Next inlines that rather than `undefined`.
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || undefined;

export const API_URL = configuredApiUrl ?? consoleApiPath(CONSOLE_KEY);

/**
 * Every request rides on the httpOnly cookie /auth/callback sets — this
 * app never touches the token value itself, it just needs the cookie sent
 * (and, in the workspace where the agent is another origin, the agent's
 * CORS config allows exactly this one).
 */
export const apiClient = createConsoleClient<paths>({
  key: CONSOLE_KEY,
  baseUrl: configuredApiUrl,
});
