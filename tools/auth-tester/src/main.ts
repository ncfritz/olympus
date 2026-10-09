/**
 * `auth-tester` -- the sign-in flows from a terminal (ADR 0018, phase 4 of
 * `docs/plans/authentication`).
 *
 *   pnpm --filter @ncfritz/olympus-auth-tester build
 *   pnpm --filter @ncfritz/olympus-auth-tester auth-tester login
 *
 * It is a real client, not a script that pokes the endpoints: PKCE with a
 * loopback redirect (RFC 8252), tokens in a mode-600 file, refresh on expiry,
 * and every call through `@ncfritz/olympus-client` with its `auth` option. The
 * point is that the flows are proved by something that implements them the way
 * an app has to, before a site or an iOS app depends on them.
 */
import { AuthFlowError } from "@ncfritz/olympus-auth-flow";
import { parseArguments } from "./args";
import { TesterError } from "./errors";
import { agentCall } from "./commands/agentCall";
import { call } from "./commands/call";
import { login } from "./commands/login";
import { logout } from "./commands/logout";
import { refresh, replay } from "./commands/refresh";
import { revoke, sessions } from "./commands/sessions";
import { whoami } from "./commands/whoami";
import { resolveSettings, SETTINGS_FLAGS } from "./settings";
import { createTester } from "./tester";

const USAGE = `Usage: auth-tester <command> [options]

  login                       signs in through a provider and stores the tokens
  whoami                      the caller as the API has them, and the token's claims
  sessions                    every session this user is signed in on
  revoke  <session-id>        ends one of them
  logout                      ends the session these tokens belong to
  refresh                     rotates the refresh token
  refresh --replay            presents the previous one again: reuse detection
  call    <method> <path>     any API call with the access token
  agent-call <method> <path>  a call on the mTLS listener with a certificate

Options

  --api <url>        the API, version included
                     (default $OLYMPUS_API_BASE_URL, or http://localhost:3001/v1)
  --external         the API at $OLYMPUS_EXTERNAL_API_BASE_URL: the border rather
                     than a workspace
  --provider <name>  which identity provider to sign in with (default google)
  --port <n>         the loopback port to catch the redirect on (default: any free)
  --stale            send the stored access token even when it has expired,
                     instead of refreshing first
  --tokens <path>    where the tokens are kept
                     (default $OLYMPUS_AUTH_TESTER_TOKENS, or ~/.olympus/auth-tester.json)
  --cert <path>      agent-call: the service certificate to present
  --key <path>       agent-call: its private key
  --ca <path>        agent-call: the CA that signed the API's certificate
  --as <name>        agent-call: the X-Olympus-Client to send
                     (default: the certificate's common name)

Tokens are never printed; the claims 'whoami' prints are not secret. The file
is mode 600 -- a refresh token lives for weeks.`;

const FLAGS = {
  value: [...SETTINGS_FLAGS.value, "cert", "key", "ca", "as"],
  boolean: [...SETTINGS_FLAGS.boolean, "replay", "help"],
} as const;

/** The exit status: 0, or 1 for a call the API refused. */
async function run(argv: string[]): Promise<number> {
  const { flags, positional } = parseArguments(argv, FLAGS);
  const [command, ...args] = positional;
  if (command === undefined || flags.help === true || command === "-h") {
    console.log(USAGE);
    return 0;
  }

  const settings = resolveSettings(process.env, flags);

  // agent-call is the one command with no user and no tokens: the identity is
  // the certificate, on the other listener.
  if (command === "agent-call") {
    return agentCall(settings, flags, args);
  }

  const tester = createTester(settings);
  switch (command) {
    case "login":
      await login(tester);
      return 0;
    case "whoami":
      await whoami(tester);
      return 0;
    case "sessions":
      await sessions(tester);
      return 0;
    case "revoke":
      await revoke(tester, args[0]);
      return 0;
    case "logout":
      await logout(tester);
      return 0;
    case "refresh":
      await (flags.replay === true ? replay(tester) : refresh(tester));
      return 0;
    case "call":
      return call(tester, args);
    default:
      throw new TesterError(`unknown command ${command}\n\n${USAGE}`);
  }
}

run(process.argv.slice(2))
  .then((status) => process.exit(status))
  .catch((error: unknown) => {
    // Either error is something the person running this can act on: a bad
    // flag, or the API refusing a grant. Anything else prints whole.
    if (error instanceof TesterError || error instanceof AuthFlowError) {
      console.error(error.message);
    } else {
      // A connection refused, a TLS handshake, a bug in here: the detail is
      // the only clue, so all of it.
      console.error(error);
    }
    process.exit(1);
  });
