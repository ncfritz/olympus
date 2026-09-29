import { isAxiosError } from "axios";

/** Why a provider call failed, without anything that could hold a key. */
export type ProviderFailure =
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "timeout"
  | "unavailable";

/**
 * A weather provider's failure, safe to log: it keeps the provider, a
 * reason and the HTTP status, and drops the request (whose URL may carry a
 * key) and the response body.
 */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly reason: ProviderFailure,
    readonly status?: number,
  ) {
    super(
      `${provider}: ${reason.replace("_", " ")}${status ? ` (HTTP ${status})` : ""}`,
    );
    this.name = "ProviderError";
  }

  static from(provider: string, error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;
    if (!isAxiosError(error)) return new ProviderError(provider, "unavailable");
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return new ProviderError(provider, "unauthorized", status);
    }
    if (status === 429) return new ProviderError(provider, "rate_limited", 429);
    if (status === 404) return new ProviderError(provider, "not_found", 404);
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ProviderError(provider, "timeout");
    }
    return new ProviderError(provider, "unavailable", status);
  }
}
