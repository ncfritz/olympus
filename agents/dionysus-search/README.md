# dionysus-search-agent

`@ncfritz/dionysus-search-agent`, imported from the dionysus-search-agents
repository with its history.

Asynchronous agents for performing media asset search tasks. These agents primarily handle executing NzbGeek
search tasks for movie and TV episodes on a scheduled and ad0hoc basis. These also include the fanout workers
that handle cascading search configurations from a TV series or TV season to the individual episodes and seasons.
The agents are triggered regularly to identify search configurations whose TTLs have expired and enqueue them
for processing.

# Development

Run from the repository root (`pnpm install` once):

- `pnpm --filter @ncfritz/dionysus-search-agent dev`: watch mode,
  environment from `dev.env` (`dev:local` reads `local.env`).
- `pnpm --filter @ncfritz/dionysus-search-agent build`, then `start` /
  `start:local` / `start:prod`.

Copy `dev.env.example` to `dev.env` (git-ignored) and fill in the values.

Requires Node 23 or later (the workspace baseline is 26): the source
detector's regular expressions use inline modifiers (`(?-i:WEB)`).

`scripts/` holds the NZBGet extension scripts (Python) that publish
download events to RabbitMQ. They can't import the TypeScript contract, so
`test/unit/scripts` checks their payloads against the JSON Schema that
`@ncfritz/olympus-messages` generates (`schemas/download-update.schema.json`).

## Layout

```
src/
  main.ts, AppModule.ts
  config/configuration.ts     typed, validated configuration (see below)
  messaging.ts                queues and subscriptions; routes and payloads
                              come from @ncfritz/olympus-messages
  infra/                      RabbitModule
  search/                     SearchModule: handlers/ (one per asset type,
                              on SearchHandler), services/NzbGeekClient
  fanout/                     FanoutModule: the periodic fanout of due
                              search configurations
  releases/                   release title parsing (detector,
                              releaseGroup) and tag
                              scoring (tag/spec: TRaSH custom formats)
```

## Messages

| Queue                                 | Routing key          | Handler                            |
| ------------------------------------- | -------------------- | ---------------------------------- |
| `search.fanout.trigger`               | (fanout)             | `SearchConfigurationFanoutHandler` |
| `search.execution.movie.trigger`      | `jobType.movie`      | `MovieSearchHandler`               |
| `search.execution.tv_series.trigger`  | `jobType.tv_series`  | `TvSeriesSearchHandler`            |
| `search.execution.tv_season.trigger`  | `jobType.tv_season`  | `TvSeasonSearchHandler`            |
| `search.execution.tv_episode.trigger` | `jobType.tv_episode` | `TvEpisodeSearchHandler`           |

The fanout publishes a search for each due search configuration, delayed
1 to 60 seconds; series searches publish season searches, and season
searches episode searches, on `search.execution.trigger`.

`pnpm --filter @ncfritz/dionysus-search-agent test` runs the unit and
convention tests.

> The Dockerfile still expects the pre-monorepo layout (npm, GitHub
> Packages token). It is rebuilt with the Docker work in ADR 0011.

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
          - localhost:13003
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

| Variable     | Usage                                   | Default Value              |
| ------------ | --------------------------------------- | -------------------------- |
| API_BASE_URL | Base URL for SDK calls, including `/v1` | `http://localhost:3001/v1` |

##### NzbGeek

| Variable        | Usage                                             | Default Value                  |
| --------------- | ------------------------------------------------- | ------------------------------ |
| NZBGEEK_API_URL | The newznab API endpoint                          | `https://api.nzbgeek.info/api` |
| NZBGEEK_API_KEY | The API key to use when authenticating to NzbGeek |                                |
