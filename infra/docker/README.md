# Docker

Images, stacks and their configuration (ADR 0011, ADR 0019,
[plan](../../docs/plans/docker/README.md)).

| Path                                        | What                                                                          | State   |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| `docker-bake.hcl`                           | Every image, its platforms and tags                                           | phase 1 |
| `node/Dockerfile`                           | The API and the agents, one Dockerfile for all                                | phase 1 |
| `hasura/`                                   | Hasura carrying the migrations and metadata; `_FILE` secrets                  | phase 1 |
| `rabbitmq/`                                 | RabbitMQ with the plugins Olympus uses; users from `users.json`               | phase 1 |
| `compose/registry.yml`                      | The image registry on the Mac Mini                                            | phase 1 |
| `compose/{data,rabbitmq,nginx,olympus}.yml` | One Compose project per stack; the Mac Mini and the laptop run the same files | phase 3 |
| `env/<host>.env`                            | The non-secret values that differ per host                                    | phase 3 |
| `stack.sh`                                  | `bootstrap`, `check`, `up`, `down` per stack                                  | phase 3 |
| `compose/nas.yml`                           | The NAS's asset agent                                                         | phase 5 |

`compose/dev.yml` (Postgres and Hasura for the workspace) is replaced by
`data.yml` with the laptop's env file in phase 3.

## Building images

From the repository root, with Docker's BuildKit (Docker Desktop has it):

```sh
docker buildx bake --load api          # one image, into the local image store
docker buildx bake --load services --set asset-agent.platform=linux/arm64
docker buildx bake                     # everything, tag "dev"

# For the registry: tagged with the commit.
REGISTRY=<registry-host>:5000 TAG=$(git rev-parse --short HEAD) \
  GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --push
```

Without `REGISTRY` the images are `olympus/<name>:<TAG>`. The asset agent
is built for `linux/amd64` (the NAS) as well as `linux/arm64`; loading a
two-platform image needs Docker's containerd image store, so a local
`--load` builds one platform.

How `node/Dockerfile` works:

1. **prune**: `turbo prune <package> --docker` keeps the package and the
   workspace packages it depends on.
2. **build**, on the build machine's platform: `pnpm install
--frozen-lockfile` from the pruned manifests (cached, so a source-only
   change skips it), then `turbo run build` for the package and its
   dependencies. An agent builds the API too: the SDK is generated from
   the API's OpenAPI documents.
3. **deploy**, on the image's platform: `pnpm deploy --prod` installs
   production dependencies, so native modules (sharp, better-sqlite3)
   are built for the CPU the image runs on.
4. **runtime**: `node:26-alpine`, the package's `files` (`dist`, and
   `templates` or `ca_roots.pem` where it has them) with its
   `node_modules`, as the `node` user, `HEALTHCHECK` on `/health`.

No image contains configuration: `/.dockerignore` keeps every `*.env`,
key and local database out of the build context, and nothing reads an env
file at start.

## Registry

`compose/registry.yml` runs `registry:3` on the Mac Mini with TLS and a
login. Once, on the Mac Mini:

1. A certificate for the registry's hostname from the internal CA
   (`TLS Web Server Authentication`), saved as
   `${SECRETS_DIR}/registry_tls_certificate` and `registry_tls_key`.
2. A login: `htpasswd -Bc "$SECRETS_DIR/registry_htpasswd" olympus`
   (`htpasswd` ships with macOS; the registry reads bcrypt only).
3. `docker compose -f infra/docker/compose/registry.yml --env-file <env>
up -d`, where the env file sets `DATA_DIR` and `SECRETS_DIR`.

On every machine that pulls or pushes: trust the internal root for that
registry (`~/.docker/certs.d/<host>:5000/ca.crt` for Docker Desktop,
`/etc/docker/certs.d/<host>:5000/ca.crt` on the NAS) and
`docker login <host>:5000`.

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
