import {
  afterIssue,
  expired,
  type IssuedTokens,
} from "@ncfritz/olympus-auth-flow";
import { TesterError } from "./errors";
import type { TokenStore } from "./tokenStore";

export type Refresher = (refreshToken: string) => Promise<IssuedTokens>;

/**
 * The `auth` provider the Olympus clients call before every request: the
 * stored access token, rotated first if it has run out.
 *
 * This is the part of a client that only a running client shows you. An
 * access token lives ten minutes and the tester is run by hand minutes or
 * hours apart, so nearly every command after the first would be a 401 without
 * it -- which is precisely the situation an app is in when it comes back from
 * the background, and the reason the option is a function rather than a
 * string.
 *
 * `--stale` sends the expired token instead, because "the API refuses an
 * expired token" is a thing worth being able to see.
 */
export const accessTokenProvider =
  (
    store: TokenStore,
    refresh: Refresher,
    options: { stale: boolean; announce?: (message: string) => void },
  ) =>
  async (): Promise<string | undefined> => {
    const saved = store.read();
    if (saved === undefined) return undefined;
    if (options.stale || !expired(saved)) return saved.accessToken;

    options.announce?.("(the access token had expired; refreshing)");
    let issued: IssuedTokens;
    try {
      issued = await refresh(saved.refreshToken);
    } catch (error: unknown) {
      throw new TesterError(
        `the access token has expired and refreshing failed: ${
          error instanceof Error ? error.message : String(error)
        }. Run login.`,
      );
    }
    store.save(afterIssue(saved, issued));
    return issued.accessToken;
  };
