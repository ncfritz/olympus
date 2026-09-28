import { TesterError } from "../errors";
import { method, request } from "../http";
import { printAnswer } from "../output";
import type { Tester } from "../tester";

/**
 * Any API call, with the access token attached the way every other Olympus
 * client attaches it.
 *
 * The path is relative to the base URL, which already includes the version:
 * `call GET /auth/me`, `call GET /ping`. Nothing is thrown for a 4xx -- the
 * refusal is what is being looked at -- but the exit status follows it, so
 * this is usable from a script.
 */
export const call = async (tester: Tester, args: string[]): Promise<number> => {
  const [asked, path] = args;
  if (asked === undefined || path === undefined) {
    throw new TesterError(
      "a method and a path are required: call GET /auth/me",
    );
  }
  if (!path.startsWith("/")) {
    throw new TesterError(
      `the path is relative to ${tester.settings.apiBaseUrl} and starts with a slash`,
    );
  }

  const answer = await request(tester.signedIn, {
    method: method(asked),
    path,
  });
  printAnswer(answer);
  return answer.status >= 400 ? 1 : 0;
};
