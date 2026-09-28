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
| A host of my own | protocol, host, optional port, then `/api/v1` |

Production and Internal are one nginx server block, so they are two names for
one API rather than two environments — worth knowing when an answer differs
between them, because it should not.

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

## Tokens

One Keychain item per API, so signing in to dev does not sign you out of
production, keyed on the base URL.

Beside each sits a presence marker, written _without_ authentication, because
`getItemAsync` resolves `null` both when there is nothing stored and when Face
ID was declined or the item was invalidated by a biometric change. Without the
marker, cancelling a prompt reads as "not signed in" — and the app would
cheerfully start a second session for someone who was already in one.
