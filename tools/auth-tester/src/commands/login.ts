import * as os from "os";
import { openInBrowser } from "../browser";
import {
  afterIssue,
  authorizeUrl,
  createPkce,
  decodeToken,
  exchangeCode,
} from "@ncfritz/olympus-auth-flow";
import { describeToken } from "../claims";
import { TesterError } from "../errors";
import { listenForRedirect } from "../loopback";
import { apiCall, printUser } from "../output";
import { nodeCrypto } from "../nodeCrypto";
import type { Tester } from "../tester";

/**
 * The authorization-code flow with PKCE, the way a desktop or CLI client has
 * to do it (RFC 8252): a loopback listener catches the redirect, and the port
 * is whatever was free.
 *
 * The listener is started before the URL is built, because the port is part of
 * the `redirect_uri` and the API compares that URI three times -- when the
 * sign-in starts, when the provider comes back, and again at the exchange.
 */
export const login = async (tester: Tester): Promise<void> => {
  const { settings } = tester;
  const listener = await listenForRedirect(
    settings.redirectPath,
    settings.port,
  );
  try {
    const pkce = createPkce(nodeCrypto);
    const verifier = await pkce.newVerifier();
    const state = await pkce.newState();
    const url = authorizeUrl(settings.apiBaseUrl, {
      clientId: settings.clientId,
      redirectUri: listener.redirectUri,
      challenge: await pkce.challengeFor(verifier),
      state,
      provider: settings.provider,
    });

    console.log(`Waiting for the redirect on ${listener.redirectUri}`);
    console.log(`Sign in with ${settings.provider}:\n  ${url}\n`);
    openInBrowser(url);

    const params = await listener.waitForRedirect();
    const refused = params.get("error");
    if (refused !== null) {
      // One code for every reason: no such user, an unverified address, a
      // disabled one, or somebody declining the consent screen. The API's log
      // is the only place they are told apart, deliberately.
      throw new TesterError(
        `the sign-in came back as ${refused}. Which reason is in the API's log, not in this redirect.`,
      );
    }
    if (params.get("state") !== state) {
      throw new TesterError(
        "the redirect carried another sign-in's state, so nothing was exchanged",
      );
    }
    const code = params.get("code");
    if (code === null) {
      throw new TesterError("the redirect carried no authorization code");
    }

    // Sixty seconds, one attempt: promptly, and not again.
    const issued = await exchangeCode(tester.post, {
      code,
      redirectUri: listener.redirectUri,
      clientId: settings.clientId,
      verifier,
      deviceName: `auth-tester on ${os.hostname()}`,
    });
    const decoded = decodeToken(issued.accessToken);
    const sessionId = decoded.claims.sid;
    tester.store.save(
      afterIssue(
        {
          apiBaseUrl: settings.apiBaseUrl,
          clientId: settings.clientId,
          provider: settings.provider,
          ...(typeof sessionId === "string" ? { sessionId } : {}),
        },
        issued,
      ),
    );

    console.log(`Signed in. Tokens are in ${tester.store.location}.`);
    console.log("The access token says:");
    console.log(describeToken(decoded).join("\n"));

    // And the directory's own answer, which is what proves the token works
    // rather than merely parses.
    const user = await apiCall("describing the signed-in user", () =>
      tester.auth.describeCurrentUser(),
    );
    console.log("The API says:");
    printUser(user);
  } finally {
    listener.close();
  }
};
