# @ncfritz/olympus-auth-tester-mobile

The sign-in flows from an iPhone, built the way the iOS app will be: phase 4 of
[the authentication plan](../../docs/plans/authentication/README.md), and the
half of it that a terminal cannot answer.

The flow itself is [`@ncfritz/olympus-auth-flow`](../../packages/auth-flow/README.md),
shared with `tools/auth-tester`. What is here is what only a device has: the
system authentication session, the Keychain, and — in phase 6 — a device
certificate.

```sh
pnpm --filter @ncfritz/olympus-auth-tester-mobile start   # Metro
npx expo run:ios                                         # a development build
```

**A development build, not Expo Go.** Expo Go carries only its own native
modules, and this app ends up with one of its own. `eas build --profile
development` does the same in the cloud; see `docs/conventions/mobile.md` before
reaching for it.

## Why native, and which flow this is

RFC 8252, _OAuth 2.0 for Native Apps_: authorization code with PKCE, handed to
the **system** authentication session rather than a WebView.
`WebBrowser.openAuthSessionAsync` is `ASWebAuthenticationSession` on iOS, which
shares Safari's cookies — so an existing Google session is reused, and whatever
authenticates the person there (passkey, Face ID, a security key) happens in
Google's own page. An embedded WebView would see all of it, which is why
RFC 8252 §8.12 forbids one and why Google refuses them.

Not RFC 8628, the device authorization grant: that is for a television, and
this API implements `authorization_code` and `refresh_token` only.

## The screen

The API to point at, persisted between launches:

| Target           | Base URL                                      |
| ---------------- | --------------------------------------------- |
| Production       | `https://olympus.ncfritz.net/api/v1`          |
| Internal         | `https://olympus.internal.ncfritz.net/api/v1` |
| Dev              | `https://olympus.dev.ncfritz.net/api/v1`      |
| A host of my own | protocol, host, optional port, and the path   |

Production and Internal are one nginx server block, so they are two names for
one API rather than two environments — worth knowing when an answer differs
between them, because it should not.

The path is a choice for a custom host because it is not the same everywhere:
an API run from the workspace serves `/v1` itself, and the `/api` in front of
the named hosts is nginx's. The wrong one answers 404 — from the router or from
nginx — and neither says which mistake it was.

`localhost` on a phone is the phone, so a laptop is reached by address.
`http://` to anything but the local network is refused by App Transport
Security before the request leaves, so the screen says so rather than letting it
look like the server is down; `NSAllowsLocalNetworking` in `app.json` is what
permits the local case at all.

Two switches:

- **Ephemeral session** — `preferEphemeralSession`, so nothing is shared with
  Safari and a different person can sign in. It is also how "the cookie sharing
  above is real" stops being an assumption.
- **Face ID for stored tokens** — `requireAuthentication` on the Keychain item.
  A simulator never prompts, which is why this can be turned off.

## Signing in

The button hands `authorizeUrl` to `openAuthSessionAsync` and waits for
`olympus-auth-tester://auth`. Then, in order: the `state` is compared (the API
returns it untouched, and checking it is the client's own half of the bargain),
an `error` parameter is reported as-is — one code for every reason, the API's log
has which — and the code is exchanged for tokens over `fetch`, form-encoded,
naming itself with `X-Olympus-Client`.

The exchange does not go through `@ncfritz/olympus-client`: that carries an
access token, and this is the call that issues one.

Afterwards the claims are on screen, decoded and **not** verified. Whether the
signature is good is the API's answer to give, and it gives it by accepting the
token — which is what the next commit's calls will do.

"Forget tokens on this device" is local only. It is not `SignOut`: the session
stays open on the API, which is a difference worth being able to see.

## Calls

Through `@ncfritz/olympus-client` with its `auth` option — the package the
agents and the site use — so this is that option's first run on a phone. "Who
am I" and "Sessions" go through `AuthApi`; the path field is any `GET` relative
to the base URL. Each one lands in the log with its status and how long it took.

The tokens are held **in memory** once read, and the Keychain is written
through on rotation. A provider that read the Keychain per request would prompt
for Face ID per request.

One rotation at a time, which is the part worth knowing: two calls either side
of an expiry would otherwise each refresh, and the second would present a token
the first had already rotated away — which the API cannot tell from a stolen one
and answers by ending the session (ADR 0018). Two buttons pressed quickly would
sign you out. `test/unit/session.spec.ts` holds that case open.

## Refresh, replay, revoke, sign out

**Refresh** rotates now, through the same one-at-a-time path a call uses, so the
button and a call cannot rotate twice. `sid` and `auth_time` come back
unchanged: rotating a token does not start a session.

**Replay previous** presents the token the last rotation replaced, and then the
live one. Both refused is reuse detection — the replay rejected _and_ the
session ended (ADR 0018). The second request is the whole point: an API that
had merely forgotten the old token would refuse the replay and leave the session
alone, and calling that detection would be believing a test that cannot fail.
The verdict is one of `revoked`, `refused-only` or `accepted`, and the check
itself is `checkReuseDetection` in the shared package — the CLI runs the same
code, so the two testers cannot disagree about what passing means.

**Sessions** lists them with a Revoke on each, including this device's own.
Revoking your own kills the refresh token while the access token lives out its
ten minutes, which the log says when it happens.

**Sign out** is the real `SignOut`, not the local forget below it.

## Tokens

One Keychain item per API, so signing in to dev does not sign you out of
production, keyed on the base URL.

Beside each sits a presence marker, written _without_ authentication, because
`getItemAsync` resolves `null` both when there is nothing stored and when Face
ID was declined or the item was invalidated by a biometric change. Without the
marker, cancelling a prompt reads as "not signed in" — and the app would
cheerfully start a second session for someone who was already in one.

## Certificate calls

The other half of ADR 0018, and the half a terminal cannot answer: the services
listener on `3443` authenticates the **caller**, by the certificate it presents,
with no token and no user. The question this section exists for is whether an app
can present one at all.

It cannot, not on its own: React Native's networking has no way to answer a
client-certificate challenge, because the identity has to reach a `URLSession`
delegate and only native code holds one. So the transport is swapped and nothing
else is — `createOlympusClients({ axios: { adapter } })` with an adapter over the
`client-identity` module, and above it the same generated SDK, the same
interceptors, the same `X-Olympus-Client`. If the SDK works here it works in the
iOS app.

Four things, in order:

1. **The listener.** Its own port, reached **directly**: a certificate presented
   at one of the named front doors reaches nginx, which terminates TLS, and
   stops there. The field suggests `https://<the host above>:3443/v1`.
2. **Choose .p12** — an identity from the Files app, and **Import** with its
   passphrase. `scripts/dev-ca.sh` writes one per agent under
   `infra/dev-ca/certs/agents/`, passphrase `olympus`; AirDrop one to the phone.
   The subject appears on screen, which is how you see which identity is
   presenting.
3. **Choose CA** — `infra/dev-ca/certs/services-ca.crt`, the whole chain. The
   API's own certificate comes from the service issuer, so this one bundle is
   both what the listener trusts for callers and what a caller trusts for it. A
   phone does not know a private CA, and installing a throwaway root on a test
   device is worse than holding its certificate: the evaluation is the system's,
   only against these authorities and **not** the system's as well, so a public
   certificate for the same name does not pass either.
4. **The client name** — `X-Olympus-Client`, defaulting to the certificate's
   common name. The API refuses a request where the two disagree, which is worth
   doing on purpose and not by accident, so it can be typed. With
   `AUTH_MODE_SERVICES=report` it is logged rather than refused, and a
   deliberate mismatch answers 200.

What each answer means:

| Presenting                                  | Expected                                                   |
| ------------------------------------------- | ---------------------------------------------------------- |
| `agents/dionysus-search-agent.p12`          | 200 — an app can present a client certificate              |
| `devices/dev-valid.p12`                     | refused: a device identity is not a service one (ADR 0023) |
| `agents/svc-revoked.p12`, `svc-expired.p12` | refused during the handshake                               |
| nothing imported                            | refused, and worth seeing: the call still goes out         |

A refused handshake has **no status**. The listener never accepted the caller, so
there is nothing to answer with; what lands in the log is whatever the system
said about it, and the reason — which certificate, which check — is in the API's
log rather than on the phone.

**The name has to be in the certificate.** A phone reaches a laptop by address,
and `api.crt` carries `localhost` and `127.0.0.1`, which on a phone mean the
phone. Trusting the CA does not help: the evaluation still checks the name.
Reissue with it:

```sh
./scripts/dev-ca.sh --force --san IP:192.168.1.10
```

Failing that, the error is a certificate one and reads like a broken CA import.

## The client-identity module

`modules/client-identity`, a local Expo module, Swift, iOS only. It imports a
PKCS#12, holds the identity, and makes requests on a `URLSession` whose delegate
answers both halves of the handshake: the client certificate with the identity,
and the server's trust evaluation against the authorities it was given.

The identity is held **in memory**, not added to the Keychain. A tester that
installed identities permanently would leave them behind after a reinstall, and
choosing when to persist one is the real app's decision rather than this one's.
"Forget" is therefore honest: there was never anything on disk.

It needs a development build — `npx expo prebuild --clean` once, then
`npx expo run:ios`. There is no web implementation and there cannot be: the
certificate store belongs to the browser, and a page can neither choose from it
nor hold a key. The `.web.ts` variant says exactly that and throws.

The translation between an axios request and the module is `src/mutualTls.ts`,
which is where the tests are: the module arrives as an argument rather than an
import, so what it does with a URL, with headers, with a body and with a status
is testable without a device. `src/identity.ts` is the wiring that passes the
real one, and its type annotation is what keeps the two declarations of the
native shapes from drifting.
