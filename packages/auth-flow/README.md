# @ncfritz/olympus-auth-flow

The user sign-in flow of [ADR 0018](../../docs/decisions/0018-authentication.md)
as functions with no platform in them: the authorization request, the two
grants, PKCE, and what an access token says.

It exists because two clients implement the same flow — `tools/auth-tester`
and `tools/auth-tester-mobile`, with the site to come — and two
implementations of a flow disagree eventually, in a way that takes an
afternoon to see.

So nothing here reaches for `crypto`, `Buffer`, `fetch` or `XMLHttpRequest`.
What it needs is injected:

```ts
const pkce = createPkce(nodeCrypto); // or an expo-crypto adapter
const verifier = await pkce.newVerifier();
const url = authorizeUrl(apiBaseUrl, { ...pkce stuff, redirectUri, provider });

const issued = await exchangeCode(post, { code, redirectUri, clientId, verifier, deviceName });
```

`post` is the caller's form-encoded POST — `FormPost` — because the token
endpoint speaks RFC 6749 and every platform has its own way of making the
request.

| Piece                                  | For                                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| `createPkce(crypto)`                   | verifier, challenge and `state`; `S256` only                     |
| `authorizeUrl(baseUrl, request)`       | where the browser is sent                                        |
| `exchangeCode`, `refreshTokens`        | the two grants, throwing `AuthFlowError` on a refusal            |
| `attemptRefresh`, `oauthError`         | a refresh whose refusal is the answer being looked for           |
| `decodeToken`, `decodeBase64Url`       | the header and claims, decoded and deliberately **not** verified |
| `SavedTokens`, `afterIssue`, `expired` | what a client keeps between runs, and when to rotate it          |

`afterIssue` keeps the refresh token a rotation replaced, because reuse
detection is a flow worth being able to exercise: presenting it again must be
refused _and_ must end the session. `checkReuseDetection` is that procedure —
both requests, and a verdict of `revoked`, `refused-only` or `accepted` — shared
so that the CLI and the phone cannot disagree about what passing means.
