/**
 * Making the SDK's requests through a native client certificate.
 *
 * `@ncfritz/olympus-client` is axios, and axios on a phone is React Native's
 * networking, which cannot present a certificate. What it *can* do is hand the
 * whole request to an adapter, so this is one: the clients, the interceptors and
 * the generated calls are unchanged, and only the transport underneath differs
 * (ADR 0018, and the border in ADR 0023).
 *
 * Imports nothing: the native module arrives as an argument, which is also what
 * makes the translation testable without a device.
 */
import type { ServiceAnswer, ServiceRequest } from "./nativeShapes";

export type { ServiceAnswer, ServiceRequest } from "./nativeShapes";

/** The one thing this needs from the native module. */
export type NativeRequest = (options: ServiceRequest) => Promise<ServiceAnswer>;

/**
 * The parts of an axios request config this reads. Not axios's own type: the
 * adapter is handed a config, and naming what it uses says more than `any` and
 * costs nothing.
 */
export type RequestConfig = {
  baseURL?: string;
  url?: string;
  method?: string;
  /** A plain object, or axios's `AxiosHeaders` (which answers `toJSON`). */
  headers?: unknown;
  data?: unknown;
  params?: unknown;
  /** Milliseconds, as axios counts them. */
  timeout?: number;
  /**
   * Axios's own contract: absent or null accepts every status, which is how
   * `validateStatus: () => true` and its opposite both reach here.
   */
  validateStatus?: ((status: number) => boolean) | null;
};

export type AdapterResponse = {
  data: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
};

/** An axios-shaped rejection: what `error.response.status` in a caller reads. */
export type AdapterFailure = Error & {
  isAxiosError: true;
  status: number;
  response: AdapterResponse;
  config: RequestConfig;
};

const ABSOLUTE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

/** Everything after the `?`, or nothing. Arrays repeat the name. */
const query = (params: unknown): string => {
  if (typeof params !== "object" || params === null) return "";
  const pairs: string[] = [];
  for (const [name, value] of Object.entries(
    params as Record<string, unknown>,
  )) {
    for (const one of Array.isArray(value) ? value : [value]) {
      if (one === undefined || one === null) continue;
      pairs.push(
        `${encodeURIComponent(name)}=${encodeURIComponent(String(one))}`,
      );
    }
  }
  return pairs.length === 0 ? "" : pairs.join("&");
};

/**
 * The absolute URL a config means.
 *
 * Built by hand rather than with `URL`, which React Native does not implement
 * dependably -- the same reason `@ncfritz/olympus-auth-flow` builds its
 * authorize URL by hand. The SDK gives an absolute `url` and an empty
 * `baseURL`; a call made straight on the axios instance gives the other way
 * round, and both have to work.
 */
export const requestUrl = (config: RequestConfig): string => {
  const path = config.url ?? "";
  const base = config.baseURL ?? "";
  const joined =
    ABSOLUTE.test(path) || base === ""
      ? path
      : path === ""
        ? base
        : `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  const extra = query(config.params);
  if (extra === "") return joined;
  return `${joined}${joined.includes("?") ? "&" : "?"}${extra}`;
};

/** Header names and values as strings, from a plain object or `AxiosHeaders`. */
export const requestHeaders = (headers: unknown): Record<string, string> => {
  if (typeof headers !== "object" || headers === null) return {};
  const source = headers as { toJSON?: () => unknown };
  const plain =
    typeof source.toJSON === "function"
      ? source.toJSON()
      : (headers as unknown);
  if (typeof plain !== "object" || plain === null) return {};
  const answer: Record<string, string> = {};
  for (const [name, value] of Object.entries(
    plain as Record<string, unknown>,
  )) {
    if (value === undefined || value === null) continue;
    answer[name] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return answer;
};

/**
 * The body as text. Axios has already run its `transformRequest` by the time an
 * adapter is called, so a JSON body arrives as a string; an object here means
 * something replaced that, and JSON is the only thing it could have meant.
 */
export const requestBody = (data: unknown): string | undefined => {
  if (data === undefined || data === null) return undefined;
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean")
    return String(data);
  if (typeof (data as { append?: unknown }).append === "function") {
    // FormData, or a stream. Nothing here can carry bytes across the bridge,
    // and silently sending `{}` would be worse than saying so.
    throw new Error(
      "a form or stream body cannot be sent through the client-identity module: use text",
    );
  }
  return JSON.stringify(data);
};

const failed = (response: AdapterResponse): AdapterFailure => {
  const error = new Error(
    `Request failed with status code ${response.status}`,
  ) as AdapterFailure;
  error.isAxiosError = true;
  error.status = response.status;
  error.response = response;
  error.config = response.config;
  return error;
};

/**
 * An axios adapter that makes every request natively.
 *
 * The body comes back as text and is left as text: axios runs its own
 * `transformResponse` on whatever an adapter resolves, which is what parses the
 * JSON -- doing it here as well would parse it twice, or differently.
 */
export const createMutualTlsAdapter =
  (request: NativeRequest) =>
  async (config: RequestConfig): Promise<AdapterResponse> => {
    const body = requestBody(config.data);
    const answer = await request({
      url: requestUrl(config),
      method: (config.method ?? "get").toUpperCase(),
      headers: requestHeaders(config.headers),
      ...(body === undefined ? {} : { body }),
      ...(config.timeout === undefined || config.timeout === 0
        ? {}
        : { timeout: config.timeout / 1000 }),
    });
    const response: AdapterResponse = {
      data: answer.body,
      status: answer.status,
      statusText: "",
      headers: answer.headers,
      config,
    };
    const validate = config.validateStatus;
    if (
      validate === undefined ||
      validate === null ||
      validate(answer.status)
    ) {
      return response;
    }
    throw failed(response);
  };

/** Lower case letters, digits and dashes: what a metrics client label allows. */
const CLIENT_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * Whether a name can be used at all. `createOlympusClients` throws for one that
 * cannot, and a tester should say so on the screen rather than crash.
 */
export const isClientName = (value: string): boolean => CLIENT_NAME.test(value);

/**
 * The client name a certificate's subject suggests.
 *
 * The API refuses a request whose `X-Olympus-Client` disagrees with the
 * certificate's common name, and the common name is what a subject summary is
 * for the certificates this deployment issues -- so this is usually right, and
 * where it is not, the screen lets it be typed.
 */
export const clientNameFor = (subject: string): string | undefined => {
  const candidate = subject
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return CLIENT_NAME.test(candidate) ? candidate : undefined;
};
