# Docker

Planned contents (ADR 0011, ADR 0019, [plan](../../docs/plans/docker/README.md)):

- `docker-bake.hcl`: every image, its platform(s) and tags
- `compose/{data,rabbitmq,nginx,olympus}.yml`: one Compose project per
  stack; the Mac Mini and the dev laptop run the same files
- `env/<host>.env`: the non-secret values that differ per host; secrets
  are files in `${SECRETS_DIR}` on the host
- `stack.sh`: `bootstrap`, `check`, `up`, `down` per stack
- `hasura/`: our Hasura image, carrying the migrations and metadata
- `rabbitmq/`: RabbitMQ with the plugins Olympus uses
- `compose/nas.yml`, `env/nas.env`: the NAS's asset agent
- Dockerfiles stay next to each app and use `turbo prune <app> --docker`

`compose/dev.yml` (Postgres and Hasura for the workspace) is replaced by
`data.yml` with the laptop's env file in phase 3.

## Secrets

Every secret is a file in the host's `${SECRETS_DIR}` (outside the
repository, readable only by the account that runs Docker), mounted into
the service at `/run/secrets/<name>` (ADR 0019). Services built on
`@ncfritz/olympus-nest` read any variable `NAME` from the file named by
`NAME_FILE`; setting both is refused at boot. A variable that is already
a path (a key file) points at the secret directly.

| File in `${SECRETS_DIR}`                                                             | Stack    | Service                | As                                                                                    |
| ------------------------------------------------------------------------------------ | -------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `postgres_password`                                                                  | data     | Postgres               | `POSTGRES_PASSWORD_FILE`                                                              |
| `hasura_admin_secret`                                                                | data     | Hasura                 | `HASURA_GRAPHQL_ADMIN_SECRET_FILE` (the image's entrypoint)                           |
|                                                                                      | olympus  | API                    | `HASURA_PASSWORD_FILE`                                                                |
| `hasura_database_url`                                                                | data     | Hasura                 | `HASURA_GRAPHQL_DATABASE_URL_FILE`, `HASURA_GRAPHQL_METADATA_DATABASE_URL_FILE`       |
| `hasura_dev_admin_secret`, `hasura_dev_database_url`                                 | data     | `hasura-dev`           | the same, for `olympus_dev` (Mac Mini only)                                           |
| `rabbitmq_definitions`                                                               | rabbitmq | RabbitMQ               | loaded at boot; written by `rabbitmq/definitions.mjs`                                 |
| `rabbitmq/<user>.password`                                                           | olympus  | each service           | `AMQP_PASSWORD_FILE`, as its own RabbitMQ user (the same file feeds the definitions)  |
| `api_tls_key`                                                                        | olympus  | API                    | `TLS_KEY=/run/secrets/api_tls_key`                                                    |
| `<service>_client_key`                                                               | olympus  | each agent             | `API_CLIENT_KEY=/run/secrets/<service>_client_key`                                    |
| `tmdb_api_key`                                                                       | olympus  | metadata agent         | `TMDB_API_KEY_FILE`                                                                   |
| `nzbgeek_api_key`                                                                    | olympus  | asset and search agent | `NZBGEEK_API_KEY_FILE`                                                                |
| `nzbget_password`, `socks_proxy_username`, `socks_proxy_password`                    | olympus  | asset agent            | `NZBGET_PASSWORD_FILE`, `SOCKS_PROXY_USERNAME_FILE`, `SOCKS_PROXY_PASSWORD_FILE`      |
| `content_ssh_password`, `dionysus_cdn_ssh_password`, `dionysus_library_ssh_password` | olympus  | asset agent            | `CONTENT_SSH_PASSWORD_FILE`, `DIONYSUS_CDN_SSH_PASSWORD_FILE`, `..._LIBRARY_..._FILE` |
| `syno_smtp_password`, `gmail_app_password`                                           | olympus  | notification agent     | `SYNO_SMTP_PASSWORD_FILE`, `GMAIL_APP_PASSWORD_FILE`                                  |
| `syno_chat_olympus_bot_token`, `syno_chat_olympus_channel_token`                     | olympus  | notification agent     | `SYNO_CHAT_OLYMPUS_BOT_TOKEN_FILE`, `SYNO_CHAT_OLYMPUS_CHANNEL_TOKEN_FILE`            |
| `minerva_auth_jwt_secret`, `google_oauth_client_secret`                              | olympus  | Minerva agent          | `AUTH_JWT_SECRET_FILE`, `GOOGLE_OAUTH_CLIENT_SECRET_FILE`                             |

The SOCKS proxy's username is here too: it is half of a NordVPN service
credential. Certificates and CA chains are not secret but are mounted
beside their keys. The NAS's asset agent reads the asset agent's rows
from its own secrets directory, with its own RabbitMQ user
(`dionysus-asset-agent-nas`) and certificate.

### RabbitMQ users

`rabbitmq/users.json` lists the vhosts and one user per service, each
allowed only its own vhosts; `olympus-dev` is the one user dev services
share, on `/dionysus-dev`. To write the definitions for a host:

```sh
node infra/docker/rabbitmq/definitions.mjs "$SECRETS_DIR" --generate-missing
```

It creates a random password for any user without one, and writes
`rabbitmq_definitions` (mode 600). The broker applies it on every start,
so changing a password is editing its file, rerunning the script and
restarting RabbitMQ, then the service. Tests:
`node --test infra/docker/rabbitmq/test/*.test.mjs`.

Minerva's user is on `/dionysus`, where the API consumes; its code still
defaults to `/`, which roadmap item 8b settles.
