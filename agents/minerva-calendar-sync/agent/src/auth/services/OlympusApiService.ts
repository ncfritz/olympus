import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { formBody, type FormAnswer } from "@ncfritz/olympus-auth-flow";
import { Inject, Injectable } from "@nestjs/common";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { OLYMPUS_CLIENT_ID } from "../authConstants";

/** How long the agent waits for the API before giving up on a request. */
const TIMEOUT_MS = 10_000;

/** An answer from the API, whatever it was. */
export interface OlympusAnswer {
  status: number;
  headers: Record<string, string>;
  /** Parsed JSON, the text when it was not JSON, or undefined when empty. */
  body: unknown;
}

/** A request the console makes of the API, through the agent. */
export interface OlympusRequest {
  method: string;
  /** From `/v1/`, with its query string. */
  path: string;
  accessToken: string;
  /** The caller's time zone, which the availability operations read. */
  timeZone?: string;
  /** JSON, for a PUT or a POST. */
  body?: unknown;
}

/**
 * The Olympus API, server to server (ADR 0029): its token endpoint, who the
 * signed-in user is, and the operations the console calls through the
 * agent. Every request names this console (ADR 0017).
 */
@Injectable()
export class OlympusApiService {
  private readonly apiUrl: string;

  constructor(@Inject(authConfig.KEY) auth: AuthConfigType) {
    this.apiUrl = auth.olympus.apiUrl;
  }

  /** A form POST to the auth endpoints, as `@ncfritz/olympus-auth-flow` speaks to them. */
  readonly postForm = async (
    path: string,
    form: Record<string, string>,
  ): Promise<FormAnswer> => {
    const answer = await this.send(`/v1${path}`, {
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
    return this.send("/v1/auth/me", { headers: bearer(accessToken) });
  }

  /** Ends the session the access token was issued from. */
  signOut(accessToken: string): Promise<OlympusAnswer> {
    return this.send("/v1/auth/logout", {
      method: "POST",
      headers: bearer(accessToken),
    });
  }

  /** One of the console's requests, as the signed-in user. */
  forward(request: OlympusRequest): Promise<OlympusAnswer> {
    const headers: Record<string, string> = bearer(request.accessToken);
    if (request.timeZone) headers["x-ncfritz-tz"] = request.timeZone;
    const hasBody =
      request.body !== undefined &&
      (request.method === "PUT" || request.method === "POST");
    if (hasBody) headers["content-type"] = "application/json";
    return this.send(request.path, {
      method: request.method,
      headers,
      body: hasBody ? JSON.stringify(request.body) : undefined,
    });
  }

  private async send(path: string, init: RequestInit): Promise<OlympusAnswer> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        [CLIENT_HEADER]: OLYMPUS_CLIENT_ID,
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

const bearer = (accessToken: string): Record<string, string> => ({
  authorization: `Bearer ${accessToken}`,
});
