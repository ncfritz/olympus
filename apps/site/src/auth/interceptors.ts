import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { client as dionysus } from "@ncfritz/olympus-sdk/dionysus";
import { client as minerva } from "@ncfritz/olympus-sdk/minerva";
import { client as olympus } from "@ncfritz/olympus-sdk/olympus";
import type { Session } from "./session";
import { CLIENT_ID } from "./tokenEndpoint";

/**
 * Where the API answers this site. The same `/api/v1` the `setConfig` calls in
 * `src/api/` use: relative, so it is same-origin, which is what lets the browser
 * send the refresh cookie and what means there is no CORS here to get wrong.
 */
export const API_BASE_URL = "/api/v1";

/** Axios config fields these interceptors read and write. */
type Config = {
  headers?: { set?: (name: string, value: string) => unknown };
  /** Set by the retry below, so one 401 buys one retry and not a loop. */
  olympusRetried?: boolean;
};

/**
 * Attaches the access token to every SDK request, and gives a 401 exactly one
 * second chance.
 *
 * One interceptor per API document, because the SDK has one client per document
 * and they share nothing. Installed once, at the root, rather than in each
 * `src/api/` class -- those are constructed per module and would stack a fresh
 * pair of interceptors every time.
 *
 * The retry is what makes an expired token invisible. `session.token()` already
 * refreshes ahead of the expiry, so a 401 means something the client could not
 * predict: a clock that disagrees, a token revoked mid-flight, or a deploy with
 * new signing keys. One retry with a freshly rotated token distinguishes those
 * from "this person is not allowed", which must stay a 401 and reach the caller.
 */
export const attachSession = (session: Session): void => {
  for (const sdk of [dionysus, minerva, olympus]) {
    const instance = sdk.instance;

    instance.interceptors.request.use(async (config) => {
      const typed = config as unknown as Config;
      typed.headers?.set?.(CLIENT_HEADER, CLIENT_ID);
      const token = await session.token();
      // No header at all when signed out, rather than an empty one: the API
      // answers "no credentials" for both, and one of them is a lie.
      if (token !== undefined) {
        typed.headers?.set?.("Authorization", `Bearer ${token}`);
      }
      return config;
    });

    instance.interceptors.response.use(undefined, async (error: unknown) => {
      const failure = error as
        { response?: { status?: number }; config?: Config } | undefined;
      const config = failure?.config;
      if (
        failure?.response?.status !== 401 ||
        config === undefined ||
        config.olympusRetried === true
      ) {
        throw error;
      }

      config.olympusRetried = true;
      const token = await session.renew();
      if (token === undefined) throw error;
      config.headers?.set?.("Authorization", `Bearer ${token}`);
      return instance.request(config as never);
    });
  }
};
