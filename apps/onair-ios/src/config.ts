/*
 * Who the app is to the API, and where the API is (ADR 0018). Pure.
 */

/**
 * The client the API registered for this app, and its redirect URI. Both are
 * matched exactly: `apps/api/src/auth/clients/clients.ts` is where they are
 * agreed, so neither is configurable here.
 */
export const CLIENT_ID = "olympus-ios";
export const REDIRECT_URI = "olympus://auth";

/** The only provider the API has configured. */
export const PROVIDER = "google";

export const API_BASE_URLS = {
  /** Through the border, with a device certificate (authentication phase 6). */
  production: "https://olympus.ncfritz.net/api/v1",
  /** The Mac Mini's nginx: on the LAN only, and no certificate needed. */
  internal: "https://olympus.internal.ncfritz.net/api/v1",
} as const;

/**
 * The API to talk to: `EXPO_PUBLIC_OLYMPUS_API_BASE_URL` when it is set (a
 * laptop running `pnpm dev`, say), else the internal name until the border
 * is live. A trailing slash is dropped, since every path is joined to it.
 */
export const apiBaseUrl = (configured: string | undefined): string => {
  const value = configured?.trim();
  if (value === undefined || value === "") return API_BASE_URLS.internal;
  return value.replace(/\/+$/, "");
};
