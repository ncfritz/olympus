# Agent conventions (`agents/*`)

Agents are NestJS applications that do asynchronous work. They receive
RabbitMQ messages, call the platform **only through
`@ncfritz/olympus-sdk`**, and publish follow-up messages. They never talk
to Hasura or Postgres for platform data. Private working state (for example
the metadata agent's SQLite cache) is allowed.

They follow the same structure as the API ([api.md](api.md),
[ADR 0014](../decisions/0014-feature-folder-layout.md)): feature modules,
injectable providers, typed configuration and Nest's `Logger`. Shared
infrastructure and message contracts come from packages
([ADR 0015](../decisions/0015-agent-layout-and-shared-packages.md)).
`agents/olympus-notification` is the reference agent.

## Layout

```
src/
  main.ts                    validates config, Winston-backed logger, listens (metrics only)
  AppModule.ts               ConfigModule (typed namespaces), metrics, RabbitModule, features
  config/configuration.ts    readConfig() + registerAs namespaces, on @ncfritz/olympus-nest
  messaging.ts               exchanges, queues, routing keys (shared ones re-exported
                             from @ncfritz/olympus-messages)
  infra/                     RabbitModule, interceptors
  api/
    OlympusApiModule.ts      configures the SDK clients once from API_BASE_URL
    <Area>Api.ts             injectable wrappers over the SDK operations the agent uses
  <feature>/                 e.g. channels/email, search/movies
    <Feature>Module.ts
    handlers/<Name>Handler.ts
    services/<Name>.ts
    formatters/ ...          (or other feature-specific folders)
test/
  unit/                      mirrors src/
  conventions/               the checks marked [checked] below
```

- File names are PascalCase and match the class they export
  (`GmailHandler.ts`). **[checked]**
- Handlers live in `handlers/`, formatters in `formatters/`. **[checked]**
- Tests live under `test/`, never in `src/`. **[checked]**

## Handlers

- A handler is an `@Injectable()` provider of its feature module with a
  `handle(message)` method decorated with
  `@RabbitSubscribe({ exchange, queue, routingKey })`, all three from
  `messaging.ts`, never string literals. **[checked]**
- Shared flow for a family of handlers goes in an abstract base class using
  a template method: the base owns the lifecycle, subclasses implement the
  work (`DeliveryHandler.deliver()` → `formatterFor()` / `send()`).
- Collaborators (SDK wrappers, transports, formatters registries) are
  injected, so handlers are unit-tested with plain mocks.
- Choices by message type are a registry provider (`EmailFormatters`), not
  a `switch` in the handler.

```ts
@Injectable()
export class GmailHandler extends SmtpHandler {
  constructor(
    formatters: EmailFormatters,
    @Inject(gmailConfig.KEY) private readonly gmail: GmailConfigType,
  ) {
    super(formatters);
  }

  @RabbitSubscribe({
    exchange: NOTIFICATIONS_EXCHANGE,
    queue: channelQueue(NotificationChannel.EMAIL),
    routingKey: notificationRoutingKey(NotificationChannel.EMAIL),
  })
  async handle(notification: SmtpNotificationEvent<NotificationContext>) {
    await this.deliver(notification);
  }
}
```

## Messaging

- **Names are built from constants.** Exchanges and routing keys that
  another service publishes to or consumes from, and the payload types of
  those messages, live in `@ncfritz/olympus-messages`; both sides compile
  against them. Queue names belong to the consumer (`messaging.ts`).
- Naming: exchange `<area>.<stage>.trigger` (`search.execution.trigger`,
  `notifications.trigger`); queue `<area>.<stage>.<type>.trigger` or
  `<area>.<channel>`; routing key `jobType.<type>` or
  `<area>.type.<channel>`.
- Exchanges an agent publishes to or consumes from are declared in its
  `RabbitModule`. Use `x-delayed-message` exchanges for delayed or
  scheduled work.
- Channels use `prefetchCount: 1` unless a handler is known to be safe to
  run concurrently.
- Handlers must be safe to run twice with the same message (redelivery).
- Publish with the injected `AmqpConnection`.
- A snapshot test pins the exchange, queue and routing-key names, so a
  rename is deliberate.

## Calling the API

- Only through the SDK, and only in `api/`: elsewhere SDK imports are
  type-only and no code builds `/v1/` URLs. **[checked]**
- `OlympusApiModule` sets `baseURL` (`API_BASE_URL`, including `/v1`) and
  `throwOnError` on each SDK client once, at startup.
- A wrapper (`WorkflowApi`, `NotificationApi`) is an `@Injectable()` class
  whose methods take plain arguments and return the unwrapped model
  (`response.data!.workflow`).

## Configuration

- `src/config/configuration.ts` reads every variable with the
  `@ncfritz/olympus-nest` readers (`readRuntimeConfig`, `readAmqpConfig`,
  `readLoggingConfig`, `EnvReader`) plus the agent's own, and exposes
  typed `registerAs` namespaces. `main.ts` calls `readConfig()` first, so
  an invalid environment stops the agent listing every problem.
- `process.env` is read nowhere else. **[checked]**
- Credentials come from the environment, never source. Every variable is
  in `dev.env.example` and the README table.
- Log the AMQP URI only as `amqp.redactedUri`.

## Errors and observability

- Log through Nest: `new Logger(MyClass.name)` (or the base class's
  `this.logger`); Winston sits behind it. No `console.*`. **[checked]**
- Record the outcome of work in the platform (status fields via the API)
  so failures are visible in the UI, as the search and workflow handlers
  do.
- The HTTP listener exists for metrics; agents expose no other endpoints
  and need no CORS, cookies or validation pipes.

## Testing

- Vitest with the `vitest/nest` preset; `test/support/setup.ts` silences
  Nest's logger (`TEST_NEST_LOGS=1` shows it).
- Unit tests for configuration, the base handler's lifecycle, every
  formatter or work method with the `api/*` wrappers mocked, and every
  handler with its transport mocked (nodemailer, socket.io, axios).
- A module test compiles `AppModule` (with `AmqpConnection` stubbed) and
  checks each handler's queue binding.
- Convention checks in `test/conventions`.
