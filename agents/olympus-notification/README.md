# olympus-notification-agent

[![Release](https://github.com/ncfritz/olympus-notification-agent/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/olympus-notification-agent/actions/workflows/release.yml)

Asynchronous agent to process notifications sent by Olympus and Olympus-adjacent
processes and handle delivery to various messaging channels.  This agent supports pushing notifications to the
following endpoint types:

1. WebSocket (Olympus)
2. SynologyChat
3. SynologyMail
4. SMTP (Gmail)

# Development
* `npm run dev` - Starts the development server (watched for changes).  Environment variables are populated from
  `dev.env`
* `npm run dev:local` - Starts the development server (watched for changes).  Environment variables are populated from
  `local.env`
* `npm run start` - Starts the development server.  Environment variables are populated from
  `dev.env`
* `npm run start:local` - Starts the development server.  Environment variables are populated from
  `local.env`

## Adding a New Notification Handler
TODO

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
          - localhost:3101
```

## Docker Image
The Docker image will expose port 3100 for metrics scraping.  Environment variables should be specified in
`production.env`.

### Environment Variables
Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### General
| Variable               | Usage                                                    | Default Value |
|------------------------|----------------------------------------------------------|---------------|
| LISTEN_PORT            | The port to listen on, this is where metrics are exposed | `3101`        |

##### Loki / Logging
| Variable               | Usage                                         | Default Value                 |
|------------------------|-----------------------------------------------|-------------------------------|
| LOKI_URL               | The URL of the Loki server to push logs to    |                               |
| LOKI_LOGGING_LEVEL     | The minimum log level to push to Loki         | `info`                        |
| ENABLE_CONSOLE_LOGGING | Whether to log to the console                 | `true` (dev) / `false` (prod) |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console | `info`                        |
| FILE_LOGGING_ENABLED   | Whether to log to a file                      | `false` (dev) / `true` (prod) |
| FILE_LOGGING_LEVEL     | The minimum log level to write to a file      | `info`                        |
| FILE_LOGGING_PATH      | The path to write logs to                     | `./logs`                      |

##### AMQP - RabbitMQ
| Variable      | Usage                                        | Default Value   |
|---------------|----------------------------------------------|-----------------|
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`          |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`     |
| AMQP_PORT     | The port to connect on                       | `5672`          |
| AMQP_USER     | The user to authenticate with                | `admin`         |
| AMQP_PASSWORD | The password to use                          | `admin`         |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus-dev` |

##### Olympus
| Variable   | Usage                                              | Default Value            |
|------------|----------------------------------------------------|--------------------------|
| WSS_HOST   | The destination to use for WebSocket notifications | `ws://localhost:3000`    |
| API_HOST   | The Olympus API host                               | `http://localhost:3001`  |              
