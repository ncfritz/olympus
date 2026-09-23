# Docker

Images, stacks and their configuration (ADR 0011, ADR 0019,
[plan](../../docs/plans/docker/README.md)).

| Path                                 | What                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `/docker-bake.hcl`                   | Every image, its platforms and tags                              |
| `node/Dockerfile`, `next/Dockerfile` | The Nest services and the Next.js apps                           |
| `hasura/`                            | Hasura carrying the migrations and metadata; `_FILE` secrets     |
| `rabbitmq/`                          | RabbitMQ with the plugins Olympus uses; users from `users.json`  |
| `compose/<stack>.yml`                | `data`, `hasura-dev`, `rabbitmq`, `olympus`, `nginx`, `registry` |
| `env/<host>.env`                     | What differs per host: paths, tags, versions, profiles, binds    |
| `env/<host>/<service>.env`           | Each service's own settings on that host                         |
| `nginx/`                             | The Olympus server blocks the shared nginx includes              |
| `stack.sh`                           | `bootstrap`, `check`, `up`, `down` and the rest, per stack       |
| `compose/nas.yml`                    | The NAS's asset agent (phase 5)                                  |

## Running the stacks

Every host runs the same compose files; `env/<host>.env` and the
per-service files under `env/<host>/` are all that differ, and neither
holds a secret. The wiring between services (hostnames, ports, secret
paths) is in the compose files.

```sh
infra/docker/stack.sh bootstrap mac-mini   # once: networks, data and secrets dirs
infra/docker/stack.sh rabbitmq-users       # RabbitMQ's users, into the secrets dir
infra/docker/stack.sh check                # every setting and secret in place
infra/docker/stack.sh up                   # the host's STACKS, in order
infra/docker/stack.sh up olympus           # or one stack
infra/docker/stack.sh logs olympus -f dionysus-asset-agent
```

| Stack        | Services                                                                               | Runs on          |
| ------------ | -------------------------------------------------------------------------------------- | ---------------- |
| `data`       | Postgres, Hasura                                                                       | Mac Mini, laptop |
| `hasura-dev` | The home lab's dev Hasura, over `olympus_dev` in the same Postgres                     | Mac Mini         |
| `rabbitmq`   | RabbitMQ                                                                               | Mac Mini, laptop |
| `olympus`    | The API, the agents, the control index; the site (`site` profile), Minerva (`minerva`) | Mac Mini, laptop |
| `nginx`      | The shared nginx; mounts `infra/docker/nginx` from the checkout                        | Mac Mini         |
| `registry`   | The image registry                                                                     | Mac Mini         |

Networks are created once by `bootstrap` and shared by name:
`olympus-data` (Postgres, both Hasuras), `olympus-graphql` (Hasura, the
API), `olympus-backend` (RabbitMQ, the API, the agents), `olympus-edge`
(nginx, the site, the API, Minerva, the registry), and the monitoring
stack's network. A service that starts before RabbitMQ or Hasura is
ready exits and its restart policy tries again.

## Building images

`/docker-bake.hcl` lists every image, its platforms and tags. It sits at
the repository root because `docker buildx bake` looks for it in the
current directory; run it from there, with Docker's BuildKit (Docker
Desktop has it):

```sh
docker buildx bake --load api          # one image, into the local image store
docker buildx bake --load services --set asset-agent.platform=linux/arm64
docker buildx bake                     # everything, tag "dev"

# For the registry: tagged with the commit.
REGISTRY=registry.internal.ncfritz.net TAG=$(git rev-parse --short HEAD) \
  GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --builder olympus --push
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

`registry.internal.ncfritz.net` is `registry:3` on the Mac Mini
(`compose/registry.yml`) behind the shared nginx, which terminates TLS
(`nginx/registry.conf`). The registry answers plain HTTP on the
`olympus-edge` network and publishes no port; it does the login itself.
Once, on the Mac Mini:

1. `docker network create olympus-edge`, and add it to the nginx
   compose file as an external network nginx joins (phase 3's
   `stack.sh bootstrap` finds it already there).
2. The certificate and key from the internal CA where the server block
   expects them, the leaf followed by any intermediate in
   `fullchain.pem`; include `nginx/registry.conf` from `nginx.conf` and
   reload nginx (`http2 on;` needs nginx 1.25.1 or later).
3. A login: `htpasswd -Bc "$SECRETS_DIR/registry_htpasswd" olympus`
   (`htpasswd` ships with macOS; the registry reads bcrypt only).
4. `DATA_DIR=... SECRETS_DIR=... docker compose -f
infra/docker/compose/registry.yml up -d`.
5. The internal DNS record: `registry.internal.ncfritz.net` → the Mac
   Mini.

On every machine that pulls or pushes: trust the internal root (in the
system keychain, or `~/.docker/certs.d/registry.internal.ncfritz.net/ca.crt`
for Docker Desktop and `/etc/docker/certs.d/...` on the NAS), then
`docker login registry.internal.ncfritz.net`, and push with
`REGISTRY=registry.internal.ncfritz.net`.

### Pushing

Docker's default builder can't build the asset agent's second platform
without Docker Desktop's containerd image store, and switching stores
hides the running containers. Pushes use a BuildKit builder of their own
instead; `--load` keeps using the default one. Once, on the Mac Mini:

```sh
cat > ~/.docker/buildkitd-olympus.toml <<'TOML'
[registry."registry.internal.ncfritz.net"]
  ca = ["/path/to/internal-root-ca.crt"]
TOML
docker buildx create --name olympus --driver docker-container \
  --config ~/.docker/buildkitd-olympus.toml --bootstrap
```

The builder runs in its own container and pushes itself, so it needs the
internal root there; Docker Desktop's keychain and `certs.d` don't reach
it. Then:

```sh
REGISTRY=registry.internal.ncfritz.net TAG=$(git rev-parse --short HEAD) \
  GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --builder olympus --push
```

## Secrets

Every secret is a file in the host's `${SECRETS_DIR}` (outside the
repository, readable only by the account that runs Docker), mounted into
the service at `/run/secrets/<name>` (ADR 0019). Services built on
`@ncfritz/olympus-nest` read any variable `NAME` from the file named by
`NAME_FILE`; setting both is refused at boot. A variable that is already
a path (a key file) points at the secret directly.

| File in `${SECRETS_DIR}`                                                             | Stack      | Service                | As                                                                                                                        |
| ------------------------------------------------------------------------------------ | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `postgres_password`                                                                  | data       | Postgres               | `POSTGRES_PASSWORD_FILE`                                                                                                  |
| `hasura_admin_secret`                                                                | data       | Hasura                 | `HASURA_GRAPHQL_ADMIN_SECRET_FILE` (the image's entrypoint)                                                               |
|                                                                                      | olympus    | API                    | `HASURA_PASSWORD_FILE`                                                                                                    |
| `hasura_database_url`                                                                | data       | Hasura                 | `HASURA_GRAPHQL_DATABASE_URL_FILE`, `HASURA_GRAPHQL_METADATA_DATABASE_URL_FILE`                                           |
| `hasura_dev_admin_secret`, `hasura_dev_database_url`                                 | hasura-dev | `hasura-dev`           | the same, for `olympus_dev` (Mac Mini only)                                                                               |
| `rabbitmq_definitions`                                                               | rabbitmq   | RabbitMQ               | loaded at boot; written by `rabbitmq/definitions.mjs`                                                                     |
| `rabbitmq/<user>.password`                                                           | olympus    | each service           | `AMQP_PASSWORD_FILE` (secrets `amqp_<service>`), as its own RabbitMQ user; the same file feeds the definitions            |
| `tls/<service>/` (a directory)                                                       | olympus    | the API, each agent    | mounted at `/run/secrets/tls`: the API's `TLS_*` and an agent's `API_CLIENT_*` point into it once certificates are issued |
| `tmdb_api_key`                                                                       | olympus    | metadata agent         | `TMDB_API_KEY_FILE`                                                                                                       |
| `nzbgeek_api_key`                                                                    | olympus    | asset and search agent | `NZBGEEK_API_KEY_FILE`                                                                                                    |
| `nzbget_password`, `socks_proxy_username`, `socks_proxy_password`                    | olympus    | asset agent            | `NZBGET_PASSWORD_FILE`, `SOCKS_PROXY_USERNAME_FILE`, `SOCKS_PROXY_PASSWORD_FILE`                                          |
| `content_ssh_password`, `dionysus_cdn_ssh_password`, `dionysus_library_ssh_password` | olympus    | asset agent            | `CONTENT_SSH_PASSWORD_FILE`, `DIONYSUS_CDN_SSH_PASSWORD_FILE`, `..._LIBRARY_..._FILE`                                     |
| `syno_smtp_password`                                                                 | olympus    | notification agent     | `SYNO_SMTP_PASSWORD_FILE`                                                                                                 |
| `minerva_auth_jwt_secret`, `google_oauth_client_secret`                              | olympus    | Minerva agent          | `AUTH_JWT_SECRET_FILE`, `GOOGLE_OAUTH_CLIENT_SECRET_FILE`                                                                 |
| `minerva_oidc_providers`                                                             | olympus    | Minerva agent          | `AUTH_OIDC_PROVIDERS_FILE`: the JSON list of providers the console signs in with, client secrets and all                  |

`stack.sh bootstrap` creates the optional ones empty (the SSH, NZBGet,
NZBGeek, TMDB, SMTP, proxy and Google client secrets): an empty file is
"not configured", and `check` says which. The rest are required.

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
