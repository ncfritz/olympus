import { AuthFlowError } from "./errors";

/**
 * What a redirect carried back, by hand rather than with `URL`.
 *
 * The redirect arrives as `olympus-auth-tester://auth?code=…&state=…` on a
 * phone and `http://127.0.0.1:1234/callback?…` on a desktop, and React
 * Native's `URL` parses neither dependably -- a custom scheme least of all.
 * Only the query is read: this flow puts nothing in a fragment, and a client
 * that accepted one would accept parameters a redirect never delivered.
 */
export const parseRedirect = (url: string): Record<string, string> => {
  const question = url.indexOf("?");
  if (question === -1) return {};
  const query = url.slice(question + 1).split("#")[0] ?? "";
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (pair === "") continue;
    const equals = pair.indexOf("=");
    const name = equals === -1 ? pair : pair.slice(0, equals);
    const value = equals === -1 ? "" : pair.slice(equals + 1);
    try {
      params[decodeURIComponent(name)] = decodeURIComponent(
        value.replace(/\+/g, " "),
      );
    } catch {
      throw new AuthFlowError(`${pair} is not a readable query parameter`);
    }
  }
  return params;
};
