# @ncfritz/olympus-client

The Olympus APIs for services and the site, over `@ncfritz/olympus-sdk`
(ADR 0017):

- `createOlympusClients({ baseUrl, clientName, metrics?, auth?, tls? })`
  creates one SDK client per API document (`olympus`, `dionysus`,
  `minerva`). Every request sends `X-Olympus-Client: <clientName>`, so the
  API can break its metrics down by caller; with `metrics`, every call is
  recorded as `http_client_request_duration_seconds` labelled with the API,
  tag and operation called.

## Signing in

`auth` sends an access token as `Authorization: Bearer <token>` (ADR 0018):

```ts
createOlympusClients({
  baseUrl,
  clientName: "olympus-auth-tester",
  auth: () => tokens.accessToken(), // may be async
});
```

A function, called per request, rather than a token. An access token lives
ten minutes and a client here is built once and held for the life of the
process — given a string it would go on sending the token it was built with
long after that token expired. Refreshing belongs in the provider, which is
the caller's business; returning `undefined` sends no header, so being signed
out is the same code path rather than a special case.

The token is fetched before the call is timed, so a provider that refreshes
does not charge the call it interrupted for its own round trip.

`AuthApi` is the caller's own account and sessions:
`describeCurrentUser`, `listSessions`, `revokeSession` and `signOut`. None of
them takes a user, because the endpoints read it from the token.

- Wrappers, one per API area, constructed with those clients: `AuthApi` and
  `NotificationApi` (Olympus), `ContentApi`, `MediaApi`, `MediaSearchApi`,
  `MetadataApi`, `JobApi` and `MetadataWorkflowApi` (Dionysus), `MailApi`
  (Minerva). A method is
  named after the SDK function it calls, takes plain arguments and returns
  the unwrapped model. A `404` throws, unless the method returns
  `T | undefined` (see "Not-found handling" in `docs/roadmap.md`).

| Entry point                          | Runs in        | For                                                                  |
| ------------------------------------ | -------------- | -------------------------------------------------------------------- |
| `@ncfritz/olympus-client`            | browsers, Node | the clients and wrappers                                             |
| `@ncfritz/olympus-client/prometheus` | Node           | `createPrometheusRequestMetrics()`                                   |
| `@ncfritz/olympus-client/nest`       | Nest services  | `OlympusClientModule`: clients and wrappers as providers, metrics on |
| `@ncfritz/olympus-client/tls`        | Node           | `createTlsAgent`/`tlsAxiosOptions`: the caller's client certificate  |

## Nest

```ts
OlympusClientModule.forRootAsync({
  inject: [olympusConfig.KEY, runtimeConfig.KEY],
  useFactory: (olympus: OlympusConfigType, runtime: RuntimeConfigType) => ({
    baseUrl: olympus.apiBaseUrl, // API_BASE_URL, with /v1
    clientName: runtime.serviceName, // the certificate's name
    tls: olympus.tls, // API_CLIENT_CERT, API_CLIENT_KEY, API_CA_CERT
  }),
}),
```

then inject a wrapper by its class (`constructor(private readonly metadata:
MetadataApi)`), or `OLYMPUS_CLIENTS` for an SDK call no wrapper covers.

## Authenticating with a certificate

A service reaches the API's mTLS listener (ADR 0018) by presenting its own
certificate: `tls` above, or `tlsAxiosOptions(tls)` in `axios` outside
Nest. `readApiClientConfig` in `@ncfritz/olympus-nest` reads the three
paths and refuses an `https` base URL without them. The agent keeps the
connection alive, so a service handshakes once and not per request.

The site does not use this: a browser sends no certificate, and the border
nginx is what checks the device certificate there.

## Next.js and other callers

```ts
const clients = createOlympusClients({
  baseUrl: "/api/v1",
  clientName: "olympus-site",
  axios: { withCredentials: true },
});
const movie = await new MetadataApi(clients).describeMovie(603);
```

A Next.js server can create its clients per request (for the caller's
cookies) and pass `metrics: createPrometheusRequestMetrics()` from the
`prometheus` entry point.

## Adding a call

Add the method to the wrapper for its API area (the folder under
`apps/api/src/<api>/`), named after the SDK function, and add its
placeholder arguments to `test/unit/apis.spec.ts`, which checks that every
method calls the operation it is named after.
