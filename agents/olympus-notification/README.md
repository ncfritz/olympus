# olympus-notification-agent

`@ncfritz/olympus-notification-agent`, imported from the
olympus-notification-agent repository with its history.

Asynchronous agent to process notifications sent by Olympus and Olympus-adjacent
processes and handle delivery to various messaging channels. This agent supports pushing notifications to the
following endpoint types:

1. WebSocket (Olympus)
2. SynologyChat
3. SynologyMail
4. SMTP (Gmail)

# Development

Run from the repository root (`pnpm install` once):

- `pnpm --filter @ncfritz/olympus-notification-agent dev`: watch mode,
  environment from `dev.env` (`dev:local` reads `local.env`).
- `pnpm --filter @ncfritz/olympus-notification-agent build`, then `start` /
  `start:local` / `start:prod`.

Copy `dev.env.example` to `dev.env` (git-ignored) and fill in the values.

> The Dockerfile still expects the pre-monorepo layout (npm, GitHub
> Packages token). It is rebuilt with the Docker work in ADR 0011.

## Layout

```
src/
  main.ts, AppModule.ts
  config/configuration.ts     typed, validated configuration (see below)
  messaging.ts                exchange, queues and routing keys
  infra/                      RabbitModule
  delivery/                   DeliveryHandler (expiry, formatter lookup, send),
                              NotificationFormatter, message and context types
  channels/<channel>/         <Channel>Module, handlers/, formatters/, services/
templates/                    Handlebars email templates, partials and images
```

Channels: `websocket` (browsers, through the API's Socket.IO gateway),
`email` (Synology mail and Gmail), `synochat` (Synology Chat webhooks).

## Adding a notification type to a channel

1. Write a formatter in `channels/<channel>/formatters/` implementing
   `NotificationFormatter` (email: extend `HandlebarsEmailFormatter` and
   add `templates/email/<type>/{subject,html,css,plaintext}.handlebars`).
2. Register it by notification type in the channel's `<Channel>Formatters`.
3. Add a test under `test/unit/channels/<channel>/`.

`pnpm --filter @ncfritz/olympus-notification-agent test` runs the unit and
convention tests.

## Monitoring

These agents expose Prometheus metrics at `/metrics`: Node's memory, event loop and GC
statistics, and `http_client_request_duration_seconds` for their calls to the Olympus API and
other services (ADR 0017). As sample Prometheus scrape configuration is as follows:

```yaml
scrape_configs:
  - job_name: nodejs
    metrics_path: /metrics
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - localhost:3101
```

## Docker Image

The Docker image will expose port 3100 for metrics scraping. Environment variables should be specified in
`production.env`.

### Environment Variables

Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### General

| Variable    | Usage                                                    | Default Value |
| ----------- | -------------------------------------------------------- | ------------- |
| LISTEN_PORT | The port to listen on, this is where metrics are exposed | `3100`        |

##### Loki / Logging

| Variable               | Usage                                         | Default Value                 |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| LOKI_URL               | The URL of the Loki server to push logs to    |                               |
| LOKI_LOGGING_LEVEL     | The minimum log level to push to Loki         | `info`                        |
| ENABLE_CONSOLE_LOGGING | Whether to log to the console                 | `true` (dev) / `false` (prod) |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console | `info`                        |
| FILE_LOGGING_ENABLED   | Whether to log to a file                      | `false` (dev) / `true` (prod) |
| FILE_LOGGING_LEVEL     | The minimum log level to write to a file      | `info`                        |
| FILE_LOGGING_PATH      | The path to write logs to                     | `./logs`                      |

##### AMQP - RabbitMQ

| Variable      | Usage                                        | Default Value   |
| ------------- | -------------------------------------------- | --------------- |
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`          |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`     |
| AMQP_PORT     | The port to connect on                       | `5672`          |
| AMQP_USER     | The user to authenticate with                | `admin`         |
| AMQP_PASSWORD | The password to use                          | `admin`         |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus-dev` |

##### Olympus

| Variable     | Usage                                              | Default Value              |
| ------------ | -------------------------------------------------- | -------------------------- |
| WSS_HOST     | The destination to use for WebSocket notifications | `ws://localhost:3000`      |
| API_BASE_URL | Base URL for SDK calls, including `/v1`            | `http://localhost:3001/v1` |

##### Delivery channels

| Variable                        | Usage                                                        | Default Value                   |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| SYNO_SMTP_HOST                  | Synology mail server                                         | `192.168.15.21`                 |
| SYNO_SMTP_USER                  | Synology mail user                                           | `ncfritz`                       |
| SYNO_SMTP_PASSWORD              | Synology mail password                                       |                                 |
| SYNO_CHAT_HOST                  | Synology Chat server                                         | `https://nfs02.sea.ncfritz.net` |
| SYNO_CHAT_OLYMPUS_BOT_TOKEN     | Token of the `olympus` chatbot webhook (skipped when unset)  |                                 |
| SYNO_CHAT_OLYMPUS_CHANNEL_TOKEN | Token of the `olympus` incoming webhook (skipped when unset) |                                 |
| GMAIL_USER                      | Gmail account                                                | `ncfritz@ncfritz.net`           |
| GMAIL_APP_PASSWORD              | Gmail app password                                           |                                 |
