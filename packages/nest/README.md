# @ncfritz/olympus-nest

NestJS infrastructure shared by the API (`apps/api`) and the agents
(`agents/*`), so each service configures and logs the same way.

- `EnvReader`, `ConfigValidationError`: read typed values from the
  environment, collecting every problem so a service reports all of them
  at boot. Any variable can come from a file instead: `NAME_FILE` names
  it, which is how Compose secrets arrive (ADR 0019).
- `readRuntimeConfig` (NODE_ENV, APP_NAME, LISTEN_PORT; `serviceName`, the
  unsuffixed name a client certificate carries),
  `readAmqpConfig` (AMQP\_\*, with a password-free `redactedUri` for logs),
  `readLoggingConfig` (console, Loki and file logging),
  `readApiClientConfig` (API_BASE_URL and the client certificate a service
  presents to the API's mTLS listener, ADR 0018).
- `createWinstonLogger`: the Winston logger behind Nest's `Logger`
  (`WinstonModule.createLogger({ instance })` in `main.ts`).
- `@ExecuteWithMetrics(operation)`: `client_<operation>_*` counters and a
  latency histogram (nestjs-metrics-reporter) around an SDK call; a 404
  resolves to `undefined`.

Each service composes these in its own `src/config/configuration.ts` and
exposes typed namespaces with `registerAs` (see `apps/api`).

## A console's sign-in through Olympus

`ConsoleSessionModule` is the half of ADR 0029's sign-in that lives in
the service behind a console (the Minerva calendar agent, Harpocrates):
the console is a client of the Olympus API, its service completes the
authorization-code flow at `<AUTH_BASE_URL>/auth/callback`, and the
browser's session rides on httpOnly cookies the service sets.

```ts
ConsoleSessionModule.forRootAsync({
  inject: [authConfig.KEY],
  useFactory: (auth: AuthConfigType) => ({
    clientId: "harpocrates-ca-console", // the API's client registry
    deviceName: "Harpocrates CA console", // its session list
    cookiePrefix: "harpocrates", // harpocrates_access_token, ...
    baseUrl: auth.baseUrl,
    webAppUrl: auth.webAppUrl,
    olympus: auth.olympus, // { apiUrl, signInUrl }
  }),
});
```

- `ConsoleSignIn`: `start` (the redirect to the API's sign-in, with PKCE),
  `complete` (the callback's code for tokens) and `refresh`, which
  answers every request presenting the same refresh token once.
- `ConsoleSession`: `fromCookies` (the access token from its cookie,
  refreshed when it has expired), `describe` (the user's email, from the
  API) and `end` (signing out).
- `sessionFromCookies`, `bearerToken`, `tokenRefusal`: the same for a
  guard that wires its own refresh and check.
- `OlympusAuthApi`: the API, server to server, naming the console in
  every request (ADR 0017).
- The cookie helpers (`sessionCookieNames`, `sessionCookieOptions`,
  `setSessionCookies`, `clearSessionCookies`) and `mayChangeWithCookies`,
  which refuses a change riding on the cookies from any origin but the
  console's.

What stays each service's own: the four routes (`/auth/login/:provider`,
`/auth/callback`, `/v1/auth/current-user`, `/v1/auth/logout`), which are
in its OpenAPI document, and its guard, which checks the token for what
it needs (a role, `auth_time`).
