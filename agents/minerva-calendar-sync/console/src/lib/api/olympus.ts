import { consoleClientName } from "@ncfritz/olympus-console";
import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { client } from "@ncfritz/olympus-sdk/minerva";
import { API_URL, CONSOLE_KEY } from "./client";

/**
 * The Olympus API's availability operations, called through this console's
 * agent (ADR 0029): the access token is the agent's httpOnly cookie, so the
 * agent presents it, and forwards those operations and no others. The
 * answers are the API's own, in its client's shapes.
 */
client.setConfig({
  baseURL: `${API_URL}/olympus/v1`,
  withCredentials: true,
  throwOnError: true,
  headers: { [CLIENT_HEADER]: consoleClientName(CONSOLE_KEY) },
});

export * from "@ncfritz/olympus-sdk/minerva";
