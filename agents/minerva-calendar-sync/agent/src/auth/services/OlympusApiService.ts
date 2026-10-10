import { type OlympusAnswer, OlympusAuthApi } from "@ncfritz/olympus-nest";
import { Injectable } from "@nestjs/common";

export type { OlympusAnswer };

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
 * The Olympus API, server to server (ADR 0029): its token endpoint and who
 * the signed-in user is come from `@ncfritz/olympus-nest`'s OlympusAuthApi;
 * what is this agent's own is the operations the console calls through it.
 * Every request names this console (ADR 0017).
 */
@Injectable()
export class OlympusApiService {
  constructor(private readonly api: OlympusAuthApi) {}

  /** A form POST to the auth endpoints, as `@ncfritz/olympus-auth-flow` speaks to them. */
  get postForm() {
    return this.api.postForm;
  }

  /** The signed-in user, as the API describes them now. */
  describeUser(accessToken: string): Promise<OlympusAnswer> {
    return this.api.describeUser(accessToken);
  }

  /** Ends the session the access token was issued from. */
  signOut(accessToken: string): Promise<OlympusAnswer> {
    return this.api.signOut(accessToken);
  }

  /** One of the console's requests, as the signed-in user. */
  forward(request: OlympusRequest): Promise<OlympusAnswer> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${request.accessToken}`,
    };
    if (request.timeZone) headers["x-ncfritz-tz"] = request.timeZone;
    const hasBody =
      request.body !== undefined &&
      (request.method === "PUT" || request.method === "POST");
    if (hasBody) headers["content-type"] = "application/json";
    return this.api.request(request.path, {
      method: request.method,
      headers,
      body: hasBody ? JSON.stringify(request.body) : undefined,
    });
  }
}
