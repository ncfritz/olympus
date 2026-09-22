import { CLIENT_HEADER, isClientName } from "@ncfritz/olympus-metrics";
import createClient, { type ClientOptions, type Client } from "openapi-fetch";
import {
  consoleApiPath,
  consoleClientName,
  type ConsoleKey,
} from "../registry";

export interface ConsoleClientOptions extends ClientOptions {
  /** The console this client belongs to: `minerva/calendar`. */
  key: ConsoleKey;
  /**
   * Where the agent is, overriding the console's own `/api`. The
   * workspace uses it to reach an agent on another port; in an image the
   * console and its agent are the same origin.
   */
  baseUrl?: string;
}

/**
 * The client a console calls its own agent with: same origin, the
 * session cookie included, and identified to the agent's request metrics
 * (ADR 0017).
 */
export const createConsoleClient = <Paths extends object>({
  key,
  baseUrl,
  headers,
  ...rest
}: ConsoleClientOptions): Client<Paths> => {
  const client = consoleClientName(key);
  if (!isClientName(client)) {
    throw new Error(
      `"${key}" does not make a usable client name ("${client}"): use lower case letters, digits and dashes`,
    );
  }
  return createClient<Paths>({
    baseUrl: baseUrl ?? ownAgentUrl(key),
    // The access token rides on an httpOnly cookie the console never
    // sees; it only has to be sent.
    credentials: "include",
    headers: { ...headers, [CLIENT_HEADER]: client },
    ...rest,
  });
};

/**
 * The console's own agent. A path is all a browser needs, but `Request`
 * (undici, and so anything rendering on the server) rejects one without
 * an origin, so it is resolved against the document's when there is one.
 */
const ownAgentUrl = (key: ConsoleKey): string => {
  const path = consoleApiPath(key);
  return typeof window === "undefined"
    ? path
    : new URL(path, window.location.origin).href;
};
