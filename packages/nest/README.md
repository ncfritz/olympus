# @ncfritz/olympus-nest

NestJS infrastructure shared by the API (`apps/api`) and the agents
(`agents/*`), so each service configures and logs the same way.

- `EnvReader`, `ConfigValidationError`: read typed values from the
  environment, collecting every problem so a service reports all of them
  at boot. Any variable can come from a file instead: `NAME_FILE` names
  it, which is how Compose secrets arrive (ADR 0019).
- `readRuntimeConfig` (NODE_ENV, APP_NAME, LISTEN_PORT),
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
