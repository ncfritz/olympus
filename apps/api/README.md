# olympus-api

[![Release](https://github.com/ncfritz/olympus-api/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/olympus-api/actions/workflows/release.yml)

The Olympus REST API

## Docker Image
The API can be run as a Docker container and will expose port 3000.

### Environment Vairables
Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### General
| Variable                 | Usage                                                                                                                                                                    | Default Value |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| LISTEN_PORT              | The port to listen on, this is where metrics are exposed                                                                                                                 | `3000`        |
| ENABLE_API_EXPLORER      | Enables the Swagger explorer interface.  This MUST be set to `true` if `NODE_ENV` is `production`.  By default the explorer is disabled when running in production mode. | `false`       |

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

##### Hasura
| Variable        | Usage                                      | Default Value |
|-----------------|--------------------------------------------|---------------|
| HASURA_PROTOCOL | How to connect to Hasura                   | `http`        |
| HASURA_HOST     | The host, or container name running Hasura | `localhost`   |
| HASURA_PORT     | The port to connect on                     | `8080`        |
| HASURA_PASSWORD | The admin password to use                  | `admin`       |

##### AMQP - RabbitMQ
| Variable      | Usage                                        | Default Value |
|---------------|----------------------------------------------|---------------|
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`        |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`   |
| AMQP_PORT     | The port to connect on                       | `5672`        |
| AMQP_USER     | The user to authenticate with                | `admin`       |
| AMQP_PASSWORD | The password to use                          | `admin`       |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus`   |