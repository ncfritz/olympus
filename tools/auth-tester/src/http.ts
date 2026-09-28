import type { OlympusClients } from "@ncfritz/olympus-client";
import { TesterError } from "./errors";
import type { FormAnswer } from "./oauth";

export type Answer = {
  status: number;
  body: unknown;
  headers: Record<string, string | undefined>;
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

/** A method as the CLI takes it, or a sentence listing the ones there are. */
export const method = (asked: string): string => {
  const upper = asked.toUpperCase();
  if (!METHODS.includes(upper)) {
    throw new TesterError(
      `${asked} is not an HTTP method; one of ${METHODS.join(", ")}`,
    );
  }
  return upper;
};

/**
 * One request through the Olympus clients.
 *
 * Through their axios instance rather than around it, so it carries what
 * every Olympus call carries -- `X-Olympus-Client`, and the access token from
 * the `auth` provider -- and so the tester exercises the same code path the
 * agents and the site use rather than a private one that happens to work.
 *
 * Nothing is thrown for a 4xx: a refusal is an answer here, and printing it
 * is the point.
 */
/**
 * A failure that never became a response, in the words of what causes it.
 *
 * Worth spelling out because the interesting one is indistinguishable from a
 * bug by its code alone: a certificate the mTLS listener refuses is a closed
 * socket and nothing else, since the request never reaches the application.
 * So is a port that something else is holding.
 */
export const transportFailure = (
  error: unknown,
  url: string,
): string | undefined => {
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return undefined;
  switch (code) {
    case "ECONNREFUSED":
      return `nothing is listening at ${url}`;
    case "ETIMEDOUT":
      return `${url} did not answer`;
    case "ECONNRESET":
    case "EPIPE":
      return [
        `${url} closed the connection without answering (${code}).`,
        "On the mTLS listener that is what a refused certificate looks like:",
        "the request never reaches the application, so the reason is in the",
        "API's log and not here. It is also what a port held by something",
        "else looks like -- `lsof -nP -iTCP:<port> -sTCP:LISTEN` says who has",
        "it, and Docker publishing the same port on 127.0.0.1 can answer over",
        "IPv4 while the workspace API has the IPv6 wildcard.",
      ].join(" ");
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return `${url} presented a certificate that does not name that host`;
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return `this caller cannot verify the certificate ${url} presented (${code}): --ca is the CA that signed it`;
    default:
      return undefined;
  }
};

/**
 * What was asked for, as axios recorded it: the base URL is the half that
 * matters here, because the usual cause is being pointed at the wrong one.
 */
export const requestedUrl = (error: unknown, path: string): string => {
  const config = (error as { config?: { baseURL?: unknown; url?: unknown } })
    .config;
  const base = typeof config?.baseURL === "string" ? config.baseURL : "";
  const asked = typeof config?.url === "string" ? config.url : path;
  return `${base}${asked}`;
};

export const request = async (
  clients: OlympusClients,
  options: {
    method: string;
    path: string;
    form?: Record<string, string>;
  },
): Promise<Answer> => {
  const response = await attempt(clients, options);
  return {
    status: response.status,
    body: response.data,
    headers: response.headers as unknown as Record<string, string | undefined>,
  };
};

const attempt = async (
  clients: OlympusClients,
  options: { method: string; path: string; form?: Record<string, string> },
) => {
  try {
    return await send(clients, options);
  } catch (error: unknown) {
    const failure = transportFailure(error, requestedUrl(error, options.path));
    if (failure === undefined) throw error;
    throw new TesterError(failure);
  }
};

const send = async (
  clients: OlympusClients,
  options: {
    method: string;
    path: string;
    form?: Record<string, string>;
  },
) => {
  const response = await clients.olympus.instance.request({
    method: options.method,
    url: options.path,
    validateStatus: () => true,
    ...(options.form === undefined
      ? {}
      : {
          data: new URLSearchParams(options.form).toString(),
          headers: { "content-type": "application/x-www-form-urlencoded" },
        }),
  });
  return response;
};

/**
 * The token endpoint, form-encoded as RFC 6749 requires. Unauthenticated
 * clients: an access token on a grant request would be noise, and on a
 * refresh it would be the token this call exists to replace.
 */
export const formPoster =
  (clients: OlympusClients) =>
  (path: string, form: Record<string, string>): Promise<FormAnswer> =>
    request(clients, { method: "POST", path, form });
