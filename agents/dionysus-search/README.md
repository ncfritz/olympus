# dionysus-search-agents

[![Release](https://github.com/ncfritz/dionysus-search-agents/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/dionysus-search-agents/actions/workflows/release.yml)

Asynchronous agents for performing media asset search tasks.  These agents primarily handle executing NzbGeek
search tasks for movie and TV episodes on a scheduled and ad0hoc basis.  These also include the fanout workers
that handle cascading search configurations from a TV series or TV season to the individual episodes and seasons.
The agents are triggered regularly to identify search configurations whose TTLs have expired and enqueue them
for processing.

# Development
* `npm run dev` - Starts the development server (watched for changes).  Environment variables are populated from
  `dev.env`
* `npm run dev:local` - Starts the development server (watched for changes).  Environment variables are populated from
  `local.env`
* `npm run start` - Starts the development server.  Environment variables are populated from
  `dev.env`
* `npm run start:local` - Starts the development server.  Environment variables are populated from
  `local.env`

## Monitoring
These agents expose a Prometheus metrics endpoint at `/metrics/` providing basic NodeJS memory, loop timing, and GC
statistics.  As sample Prometheus scrape configuration is as follows:

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
The Docker image will expose port 3100 for metrics scraping.  Environment variables should be specified in
`production.env`.

### Environment Variables
Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### Loki / Logging
| Variable               | Usage                                                    | Default Value |
|------------------------|----------------------------------------------------------|---------------|
| LOKI_URL               | The URL of the Loki server to push logs to               |               |
| LOKI_LEVEL             | The minimum log level to push to Loki                    | `debug`       |
| ENABLE_CONSOLE_LOGGING | Whether to log to the console                            | `true`        |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console            | `debug`       |
| LISTEN_PORT            | The port to listen on, this is where metrics are exposed | `13003`       |

##### AMQP - RabbitMQ
| Variable      | Usage                                        | Default Value   |
|---------------|----------------------------------------------|-----------------|
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`          |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`     |
| AMQP_PORT     | The port to connect on                       | `5672`          |
| AMQP_USER     | The user to authenticate with                | `admin`         |
| AMQP_PASSWORD | The password to use                          | `admin`         |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus-dev` |

##### Dionysus
| Variable         | Usage                                | Default Value |
|------------------|--------------------------------------|---------------|
| EVENTS_DIRECTORY | The path to write NzbGet messages to |               |
| PERSIST_EVENTS   | The path to write the entity cache   |               |

##### NzbGeek
| Variable        | Usage                                             | Default Value |
|-----------------|---------------------------------------------------|---------------|
| NZBGEEK_API_KEY | The API key to use when authenticating to NzbGeek |               |
