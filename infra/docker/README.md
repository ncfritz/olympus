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
| `env/<env>.env`                      | What differs per environment: paths, tags, versions, profiles    |
| `env/<env>/<service>.env`            | Each service's own settings there                                |
| `nginx/`                             | The Olympus server blocks the shared nginx includes              |
| `stack.sh`                           | `bootstrap`, `check`, `up`, `down` and the rest, per stack       |
| `compose/nas.yml`                    | The NAS's asset agent (phase 5)                                  |

## Running the stacks

Every environment runs the same compose files — `prod` on the Mac Mini,
`local` on the laptop; `env/<env>.env` and the per-service files under
`env/<env>/` are all that differ, and neither holds a secret. The wiring between services (hostnames, ports, secret
paths) is in the compose files.

```sh
infra/docker/stack.sh bootstrap prod       # once: networks, data and secrets dirs
infra/docker/stack.sh rabbitmq-users       # RabbitMQ's users, into the secrets dir
infra/docker/stack.sh check                # every setting and secret in place
infra/docker/stack.sh up                   # this environment's STACKS, in order
infra/docker/stack.sh up olympus           # or one stack
infra/docker/stack.sh logs olympus -f dionysus-asset-agent
```

| Stack        | Services                                                                               | Runs on     |
| ------------ | -------------------------------------------------------------------------------------- | ----------- |
| `data`       | Postgres, Hasura                                                                       | prod, local |
| `hasura-dev` | The home lab's dev Hasura, over `olympus_dev` in the same Postgres                     | Mac Mini    |
| `rabbitmq`   | RabbitMQ                                                                               | prod, local |
| `olympus`    | The API, the agents, the control index; the site (`site` profile), Minerva (`minerva`) | prod, local |
| `nginx`      | The shared nginx; mounts `infra/docker/nginx` from the checkout                        | Mac Mini    |
| `registry`   | The image registry                                                                     | Mac Mini    |
| `nas`        | The asset agent's other deployment, where the media is                                 | nfs01       |

Networks are created once by `bootstrap` and shared by name:
`olympus-data` (Postgres, both Hasuras), `olympus-graphql` (Hasura, the
API), `olympus-backend` (RabbitMQ, the API, the agents), `olympus-edge`
(nginx, the site, the API, Minerva, the registry), and the monitoring
stack's network. A service that starts before RabbitMQ or Hasura is
ready exits and its restart policy tries again.

### The NAS

`nas` is part of the `prod` environment — machines are not environments
([ADR 0022](../../docs/decisions/0022-environments-not-machines.md)) — but
it runs on nfs01, so it is driven over a Docker context and is left out of
`STACKS` so that `up` and `down` never reach it by accident:

```sh
docker context create nas --docker host=ssh://<user>@nfs01.sea.ncfritz.net
DOCKER_CONTEXT=nas infra/docker/stack.sh up nas
```

Compose runs on the machine you type on and only needs a reachable daemon
at the other end, so DSM's own bundled Compose is never used. Two things
DSM makes awkward:

- The remote `docker` must be on the `PATH` of a **non-interactive** shell.
  DSM's package directories are not, so `ssh nfs01 docker version` fails
  with `command not found` until there is a link into `/usr/bin`.
- Every path in `compose/nas.yml` is a `NAS_` setting, because Compose
  resolves bind mounts and secret files on the Docker _host_. The NAS keeps
  its own `${NAS_SECRETS_DIR}` holding the asset agent's rows and its own
  `rabbitmq/dionysus-asset-agent-nas.password`, copied from prod's — the
  definitions are generated once, on the Mac Mini, for every user including
  this one.

The agent runs as **uid 1028** (`dionysus`), not the image's `node`, because
Synology ACLs on `/volume4/Dionysus` override the mode bits: a directory
that reads `drwxrwxrwx+` is unreachable to another uid, and presents as
missing rather than as a refusal — `existsSync` says no and the next line
tries to create it. Its secrets are owned by that uid for the same reason.
Chowning the media directories instead would break everything else that
reaches them as `dionysus`.

Copying anything to the NAS needs `scp -O`: DSM's OpenSSH is old enough
that it has no SFTP subsystem for scp to use, and scp has defaulted to SFTP
since OpenSSH 9. `scp` also does not preserve modes, so a credential
arrives world-readable; fix the files afterwards, and only the files —
`chmod 600 <dir>/*` takes the execute bit off `rabbitmq/` and `tls/` too,
and a directory without it cannot be traversed, which reads exactly like an
ACL problem and is not one:

```sh
find "$NAS_SECRETS_DIR" -type d -exec chmod 700 {} + -o -type f -exec chmod 600 {} +
```

The asset agent is the only image built for two platforms, so it is the one
that has to reach the registry by `--push` rather than `--load`.

#### Trusting the registry

DSM ignores `/etc/docker/certs.d` — the usual per-registry trust directory
does nothing here, and a pull keeps failing with `certificate signed by
unknown authority` however correct the bundle in it is. Container Manager
uses DSM's own system bundle instead:

```sh
sudo mkdir -p /usr/syno/etc/security-profile/ca-bundle-profile/ca-certificates
# One .crt file per certificate — a concatenated bundle is not read.
# The root and every intermediate that signed the registry's certificate:
#   ncfritz.net Root CA 1 → Intermediate CA 1 → Issuing CA 2 - G1
sudo /usr/syno/bin/update-ca-certificates.sh
sudo synopkg restart ContainerManager
```

`stack.sh check nas` validates the compose file and its settings but not
the secret files: those paths are on the NAS, and checking them against the
Mac Mini's filesystem would call every one of them missing. It says so
rather than reporting a problem. A context selected with `docker context
use` instead of `DOCKER_CONTEXT` is invisible to it, so prefer the variable.

Each certificate has to be its own file; the concatenated `ca.crt` that
`certs.d` would take is not what this reads. Re-check it after a DSM
upgrade — this is DSM's own tree, not ours.

### DNS from containers

A host has to let its containers resolve names on the public internet:
Minerva's OIDC discovery, the calendar providers' APIs and TMDB all go
out. Docker Desktop's own resolver does this, but a `dns` list in the
daemon's configuration replaces it wholesale, and on Docker Desktop a
resolver on the LAN is often unreachable from inside a container even
though the host reaches it fine.

The symptom is not "no DNS": it is slow lookups and, in Node, a bare
`TypeError: fetch failed` with `EAI_AGAIN` underneath, because the
embedded resolver is still working through two dead servers when the
process gives up. `docker run --rm alpine sh -c 'nslookup example.com'`
shows it — an answer from the _third_ nameserver in the list, after a
pause.

So leave the daemon's `dns` unset and let Docker Desktop forward to the
host. If a host does need it set, the servers in it have to be reachable
from a container, which is worth checking rather than assuming:

```sh
docker run --rm alpine cat /etc/resolv.conf
docker run --rm alpine nslookup accounts.google.com
```

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
it. The same is true of its network: it resolves and connects on its own,
through Docker's bridge rather than the host's resolver. Then:

```sh
REGISTRY=registry.internal.ncfritz.net TAG=$(git rev-parse --short HEAD) \
  GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --builder olympus --push
```

**On the Mac Mini, build with `--load` instead.** The registry is on the
Mac Mini, so a push from there is a container reaching its own host's LAN
address and coming back in through nginx — a round trip Docker Desktop
does not reliably make, and a pointless one: `--load` puts the image
straight into the store the Compose services pull from, under the same
`registry.internal.ncfritz.net/olympus/...` name when `REGISTRY` is set.

```sh
REGISTRY=registry.internal.ncfritz.net TAG=$(git rev-parse --short HEAD) \
  GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --load <targets>
```

The registry is for the machines that are not the build host — local,
the NAS — and for the asset agent's `amd64` image, which needs
the container builder and a push whatever else is going on.

## Secrets

Every secret is a file in the environment's `${SECRETS_DIR}` (outside the
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

### Tests

`stack.sh` and the RabbitMQ definitions script have their own tests, run
directly rather than through Turbo (neither is a workspace package):

```sh
node --test infra/docker/test/*.test.mjs
node --test infra/docker/rabbitmq/test/*.test.mjs
```

`stack.sh`'s cover the failures that do not need Docker — an unknown stack,
an unknown command, no environment chosen — because those are the ones a
silent exit hides.

### RabbitMQ users

`rabbitmq/users.json` lists the vhosts and one user per service, each
allowed only its own vhosts; `olympus-dev` is the one user dev services
share, on `/dionysus-dev`. To write the definitions for an environment:

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
