# @ncfritz/olympus-nest

NestJS infrastructure shared by the API (`apps/api`) and the agents
(`agents/*`), so each service configures and logs the same way.

- `EnvReader`, `ConfigValidationError`: read typed values from the
  environment, collecting every problem so a service reports all of them
  at boot.
- `readRuntimeConfig` (NODE_ENV, APP_NAME, LISTEN_PORT),
  `readAmqpConfig` (AMQP\_\*, with a password-free `redactedUri` for logs),
  `readLoggingConfig` (console, Loki and file logging).
- `createWinstonLogger`: the Winston logger behind Nest's `Logger`
  (`WinstonModule.createLogger({ instance })` in `main.ts`).

Each service composes these in its own `src/config/configuration.ts` and
exposes typed namespaces with `registerAs` (see `apps/api`).
