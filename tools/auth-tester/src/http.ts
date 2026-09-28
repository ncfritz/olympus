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
export const request = async (
  clients: OlympusClients,
  options: {
    method: string;
    path: string;
    form?: Record<string, string>;
  },
): Promise<Answer> => {
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
  return {
    status: response.status,
    body: response.data,
    headers: response.headers as unknown as Record<string, string | undefined>,
  };
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
