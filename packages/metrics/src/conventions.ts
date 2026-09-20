/**
 * The platform's request metrics (ADR 0017). Every HTTP call between
 * Olympus services is measured twice, with the same labels:
 *
 * - by the caller, as HTTP_CLIENT_REQUEST_DURATION (`client` is itself,
 *   `server` the service it called);
 * - by the callee, as HTTP_SERVER_REQUEST_DURATION (`server` is itself,
 *   `client` the caller's CLIENT_HEADER).
 *
 * Names follow the OpenTelemetry HTTP conventions, in seconds.
 */

/** Sent by every Olympus client with its name (lower case, as sent). */
export const CLIENT_HEADER = "x-olympus-client";

export const HTTP_CLIENT_REQUEST_DURATION =
  "http_client_request_duration_seconds";
export const HTTP_SERVER_REQUEST_DURATION =
  "http_server_request_duration_seconds";

export const REQUEST_LABELS = [
  "client",
  "server",
  "api",
  "tag",
  "operation",
  "method",
  "status_code",
] as const;
export type RequestLabel = (typeof REQUEST_LABELS)[number];
export type RequestLabels = Record<RequestLabel, string>;

/** Histogram buckets, in seconds. */
export const DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
];

/** A label value that is not known: no client header, no matching operation. */
export const UNKNOWN = "unknown";
/** A client header that is not a valid client name. */
export const OTHER = "other";
/** The status code of a request that got no response. */
export const NO_RESPONSE = "none";

const CLIENT_NAME = /^[a-z][a-z0-9-]{0,62}$/;

/** Whether `name` can be sent as a client name. */
export const isClientName = (name: string): boolean => CLIENT_NAME.test(name);

/** The `client` label for a received CLIENT_HEADER value. */
export const clientLabel = (header: string | string[] | undefined): string => {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return UNKNOWN;
  return isClientName(value) ? value : OTHER;
};

/** The `status_code` label: the response status, or NO_RESPONSE. */
export const statusCodeLabel = (status: number | undefined): string =>
  status !== undefined && status >= 100 && status <= 599
    ? String(status)
    : NO_RESPONSE;
