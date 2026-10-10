import { formBody, type FormAnswer } from "@ncfritz/olympus-auth-flow";
import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { Inject, Injectable } from "@nestjs/common";
import { CONSOLE_SESSION_CONFIG, type ConsoleSessionConfig } from "./config";

/** How long the service waits for the API before giving up on a request. */
const TIMEOUT_MS = 10_000;

/** An answer from the API, whatever it was. */
export interface OlympusAnswer {
  status: number;
  headers: Record<string, string>;
  /** Parsed JSON, the text when it was not JSON, or undefined when empty. */
  body: unknown;
}

/**
 * The Olympus API, server to server (ADR 0029): its token endpoint, who
 * the signed-in user is, and anything else the console asks of it through
 * its service. Every request names the console (ADR 0017).
 */
@Injectable()
export class OlympusAuthApi {
  private readonly apiUrl: string;
  private readonly clientId: string;

  constructor(@Inject(CONSOLE_SESSION_CONFIG) config: ConsoleSessionConfig) {
    this.apiUrl = config.olympus.apiUrl;
    this.clientId = config.clientId;
  }

  /** A form POST to the auth endpoints, as `@ncfritz/olympus-auth-flow` speaks to them. */
  readonly postForm = async (
    path: string,
    form: Record<string, string>,
  ): Promise<FormAnswer> => {
    const answer = await this.request(`/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody(form),
    });
    return {
      status: answer.status,
      body: answer.body ?? {},
      headers: answer.headers,
    };
  };

  /** The signed-in user, as the API describes them now. */
  describeUser(accessToken: string): Promise<OlympusAnswer> {
    return this.request("/v1/auth/me", { headers: bearer(accessToken) });
  }

  /** Ends the session the access token was issued from. */
  signOut(accessToken: string): Promise<OlympusAnswer> {
    return this.request("/v1/auth/logout", {
      method: "POST",
      headers: bearer(accessToken),
    });
  }

  /** Any request of the API's, from its path (`/v1/...`). */
  async request(path: string, init: RequestInit): Promise<OlympusAnswer> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        [CLIENT_HEADER]: this.clientId,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    let body: unknown = text === "" ? undefined : text;
    try {
      body = text === "" ? undefined : JSON.parse(text);
    } catch {
      // A proxy's error page, most likely: kept as text.
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    return { status: response.status, headers, body };
  }
}

/** The Authorization header for an access token. */
export const bearer = (accessToken: string): Record<string, string> => ({
  authorization: `Bearer ${accessToken}`,
});
