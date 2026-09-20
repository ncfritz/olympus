import createClient from "openapi-fetch";
import type { paths } from "../../generated/api";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4432";

/**
 * Every request rides on the httpOnly cookie /auth/callback sets — this app
 * never touches the token value itself, it just needs `credentials:
 * "include"` on every cross-origin call (the API's CORS config allows this
 * origin specifically, see WEB_APP_URL in the API's .env).
 */
export const apiClient = createClient<paths>({
  baseUrl: API_URL,
  credentials: "include",
});

export function loginUrl(provider: string): string {
  const returnTo = typeof window !== "undefined" ? window.location.origin : "";
  return `${API_URL}/auth/login/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
}
