# olympus-api

The Olympus REST API (`@ncfritz/olympus-api`). Imported from
`github.com/ncfritz/olympus-api` with full history.

- Conventions: [`docs/conventions/api.md`](../../docs/conventions/api.md)
- Depends on `@ncfritz/olympus-model` from the workspace.

## Development

```sh
cp dev.env.example dev.env      # fill in values
pnpm turbo run build --filter=@ncfritz/olympus-api...
pnpm --filter @ncfritz/olympus-api dev
```

## OpenAPI documents

`pnpm turbo run openapi --filter=@ncfritz/olympus-api` builds the API and
writes `openapi/olympus.json`, `openapi/dionysus.json` and
`openapi/minerva.json`. These files are committed so API changes show up
in review. The SDK is generated from them.

The generator (`src/openapi.ts`) creates the Nest application without
listening and stubs the AMQP connection, so it needs no Hasura or
RabbitMQ.

> The Dockerfile still expects the pre-monorepo layout (npm, GitHub
> Packages token). It is rebuilt with the Docker work in ADR 0011. Until
> then, deploy the API from the original olympus-api repository.

## Docker Image

The API can be run as a Docker container and will expose port 3000.

### Environment variables

`src/config/configuration.ts` reads and validates these at boot. The API
refuses to start and lists every missing or invalid variable. Code gets
them as typed namespaces (`server`, `auth`, `hasura`, `amqp`, `logging`,
`dionysus`), never from `process.env`.

##### General

| Variable            | Usage                                                        | Default                    |
| ------------------- | ------------------------------------------------------------ | -------------------------- |
| NODE_ENV            | `production` switches the production defaults below          | `development`              |
| APP_NAME            | Service name in logs and metric labels                       | `olympus-api[-<NODE_ENV>]` |
| LISTEN_PORT         | The port to listen on (metrics are exposed here too)         | `3100`                     |
| ENABLE_API_EXPLORER | Serve the Swagger explorer in production (always on in dev)  | `false`                    |
| CORS_ORIGINS        | Comma-separated origins allowed to call the API with cookies | `http://localhost:3000`    |

##### Authentication

See [ADR 0018](../../docs/decisions/0018-authentication.md). Each listener
is in `report` mode until its callers have moved over: a request that
would be refused is logged and counted (`auth_decisions_total`) but still
served. The services listener only starts when it has certificates.

| Variable             | Usage                                                              | Default  |
| -------------------- | ------------------------------------------------------------------ | -------- |
| AUTH_MODE_USERS      | `report` or `enforce` for the user listener (tokens)               | `report` |
| AUTH_MODE_SERVICES   | `report` or `enforce` for the services listener (certificates)     | `report` |
| AUTH_SERVICE_ROLES   | `<service>:<role>\|<role>`, comma-separated; the known services    | (empty)  |
| SERVICES_LISTEN_PORT | The mTLS listener's port                                           | `3443`   |
| TLS_CERT             | The API's server certificate (with TLS_KEY and TLS_CA_SERVICES)    | (off)    |
| TLS_KEY              | Its private key                                                    | (off)    |
| TLS_CA_SERVICES      | The Olympus Services chain the listener trusts                     | (off)    |
| TLS_CRL_SERVICES     | Revocation lists, one file each: the intermediate's and the root's | (empty)  |

`scripts/dev-ca.sh` writes a throwaway CA and the certificates the tests
and a local run need into `infra/dev-ca/certs`.

##### Logging

| Variable               | Usage                                         | Default                       |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| LOKI_LEVEL             | The logger's overall minimum level            | `debug`                       |
| LOKI_URL               | The URL of the Loki server to push logs to    |                               |
| LOKI_LOGGING_LEVEL     | The minimum log level to push to Loki         | `info`                        |
| ENABLE_CONSOLE_LOGGING | Log to the console in production              | `true` (dev) / `false` (prod) |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console | `info`                        |
| FILE_LOGGING_ENABLED   | Log to rotating files outside production      | `false` (dev) / `true` (prod) |
| FILE_LOGGING_LEVEL     | The minimum log level to write to a file      | `info`                        |
| FILE_LOGGING_PATH      | The directory to write logs to                | `./logs/`                     |

Levels are Winston's: `error`, `warn`, `info`, `http`, `verbose`,
`debug`, `silly`.

##### Hasura

| Variable        | Usage                                      | Default     |
| --------------- | ------------------------------------------ | ----------- |
| HASURA_PROTOCOL | `http` or `https`                          | `http`      |
| HASURA_HOST     | The host, or container name running Hasura | `localhost` |
| HASURA_PORT     | The port to connect on                     | `8080`      |
| HASURA_PASSWORD | The admin secret                           | (empty)     |

##### AMQP - RabbitMQ

| Variable      | Usage                                        | Default     |
| ------------- | -------------------------------------------- | ----------- |
| AMQP_PROTOCOL | `amqp` or `amqps`                            | `amqp`      |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost` |
| AMQP_PORT     | The port to connect on                       | `5672`      |
| AMQP_USER     | The user to authenticate with                | `admin`     |
| AMQP_PASSWORD | The password to use (never logged)           | `admin`     |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus` |

##### Dionysus

| Variable              | Usage                                          | Default  |
| --------------------- | ---------------------------------------------- | -------- |
| DIONYSUS_UPLOAD_PATH  | Where UploadAssets writes files                | required |
| DIONYSUS_PUBLISH_PATH | The same directory as the ingest agents see it | required |
