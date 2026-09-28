import { formBody, type FormPost } from "@ncfritz/olympus-auth-flow";

/**
 * The token endpoint, over `fetch` and deliberately not over the SDK.
 *
 * Two reasons. It is the call that issues an access token, so it cannot carry
 * one -- and the SDK's interceptor attaches one to everything, which for this
 * request would mean refreshing in order to refresh. And the refresh cookie is
 * the whole point: `fetch` sends it because this is a same-origin request to the
 * path the cookie is scoped to (`/api/v1/auth`), and `credentials: "include"`
 * says so explicitly rather than relying on the default.
 */
export const tokenEndpoint = (apiBaseUrl: string): FormPost => {
  const base = apiBaseUrl.replace(/\/+$/, "");
  return async (path, form) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        // ADR 0017: every caller names itself, this one included.
        "x-olympus-client": CLIENT_ID,
      },
      body: formBody(form),
    });

    const text = await response.text();
    let body: unknown = text;
    try {
      body = text === "" ? {} : JSON.parse(text);
    } catch {
      // A proxy's HTML error page, most likely. Left as text: the flow reports
      // the status and the body, and a parse failure here would hide both.
    }

    const headers: Record<string, string | undefined> = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });

    return { status: response.status, body, headers };
  };
};

/** This site, as the API's client registry knows it (ADR 0018). */
export const CLIENT_ID = "olympus-site";
