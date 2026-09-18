# Agent conventions (`agents/*`)

Agents are NestJS applications that do asynchronous work. They receive
RabbitMQ messages, call the platform **only through
`@ncfritz/olympus-sdk`**, and publish follow-up messages. They never talk
to Hasura or Postgres for platform data. Private working state (for example
the metadata agent's SQLite cache) is allowed.

## Layout

```
src/
  main.ts                 bootstrap: Winston logger, ValidationPipe, Prometheus interceptor, listen
  module/
    AppModule.ts          ConfigModule, RabbitModule, handlers as providers
    RabbitModule.ts       RabbitMQModule.forRootAsync: connection, channels, exchanges
  handler/<area>/<Name>Handler.ts
  api/
    apiBase.ts            BASE_URL, shared helpers (encodeFilters)
    <area>Api.ts          thin wrapper over SDK operations
  types/messages.ts       message payload types
  util/
    constants.ts          exchange, queue and routing-key names; IS_PROD
    logger.ts
```

Domain-specific folders (`workflow/`, `ingest/`, `metadata/`, `cache/`,
`formatter/`) sit beside these as needed.

## Handlers

- One handler class per message type, in `handler/<area>/<Name>Handler.ts`.
  The file name matches the class name (PascalCase).
- Handlers are `@Injectable()` providers registered in `AppModule`.
- The subscribing method is `handle(msg: <Message>, amqpMsg: ConsumeMessage)`
  decorated with `@RabbitSubscribe({ exchange, queue, routingKey })`, all
  three taken from `util/constants.ts`.
- Shared flow for a family of handlers goes in an abstract
  `Base<Area>Handler` using a template method: the base class owns the
  lifecycle (record start, call the abstract `do<Work>()`, record the
  result, notify), and subclasses implement only the work.

```ts
@Injectable()
export class MovieSearchHandler extends BaseSearchHandler {
  @RabbitSubscribe({
    exchange: SEARCH_EXECUTION_TRIGGER_EXCHANGE,
    queue: `${SEARCH_EXECUTION_PREFIX}.movie.${TRIGGER_SUFFIX}`,
    routingKey: `${MEDIA_TYPE_PREFIX}.movie`,
  })
  public async handle(msg: SearchExecutionMessage, amqpMsg: ConsumeMessage) {
    await this.execute("movie", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    // ...
  }
}
```

## Messaging

- **Names are built from constants** in `util/constants.ts`:
  - prefixes by area: `search`, `media`, ...
  - suffix `trigger` for exchanges that start work
  - exchange: `<area>.<stage>.trigger` (`search.execution.trigger`)
  - queue: `<area>.<stage>.<type>.trigger` (`search.execution.movie.trigger`)
  - routing key: `jobType.<type>` (`jobType.movie`, `jobType.cleanup`)
- Exchanges an agent publishes to or consumes from are declared in its
  `RabbitModule`. Use `x-delayed-message` exchanges for delayed or
  scheduled work.
- Channels use `prefetchCount: 1` unless a handler is known to be safe to
  run concurrently.
- Message payloads are TypeScript `type`s in `types/messages.ts`. A payload
  consumed by a different service than the one that publishes it moves to a
  shared package so both sides compile against one definition.
- Handlers must be safe to run twice with the same message (redelivery).
- Publish with the injected `AmqpConnection`.

## Calling the API

- Only through the SDK. Wrap the SDK functions an agent uses in
  `api/<area>Api.ts`: a class whose constructor configures the SDK client
  (`client.setConfig({ baseURL: BASE_URL, throwOnError: true })`), exported
  as a default singleton.
- Wrapper methods take plain arguments and return the SDK response.
- `BASE_URL` comes from `API_BASE_URL`.

## Configuration

- `ConfigService` for all settings. AMQP connection settings are
  `AMQP_PROTOCOL`, `AMQP_HOST`, `AMQP_PORT`, `AMQP_USER`, `AMQP_PASSWORD`,
  `AMQP_VHOST`.
- Log the AMQP host and vhost at startup, **never the full URI** (it
  contains the password).

## Errors and observability

- Log through `logger` (Winston). No `console.log`.
- Record the outcome of work in the platform (status fields via the API) so
  failures are visible in the UI, as the search and workflow handlers do.
- The HTTP listener exists for metrics and health; agents expose no other
  HTTP endpoints.

## Testing

- The handler's work method (`do<Work>`) is tested with the `api/*`
  wrappers mocked.
- Message-name constants are covered by a snapshot so a rename is
  deliberate.
