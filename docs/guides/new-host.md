# Standing up a host

From an empty machine to a running platform. Written from the two times
this was actually done: local's build from nothing
([docker plan](../plans/docker/README.md) phase 3.8) and the production
cutover (phase 4). Where a step carries a warning, the warning is there
because that is what went wrong.

Read [`infra/docker/README.md`](../../infra/docker/README.md) alongside
this: it holds the stack table, the secrets inventory and the image
build commands, and this guide links to it rather than copying it. One
list that drifts is bad enough.

## 1. Docker

Docker Desktop, or Engine on Linux. Two settings matter.

**Leave the daemon's `dns` unset.** A list that ends in public servers
makes container lookups slow and internal names unreliable — the symptom
is not "no DNS" but a pause and then a bare `TypeError: fetch failed`
with `EAI_AGAIN` underneath, because the embedded resolver is still
working through dead servers when the process gives up. That cost a day
in phase 3. `infra/docker/README.md`, _DNS from containers_, has the
checks.

**Turn on the containerd image store** if this machine will build the
asset agent, which is built for two platforms.

## 2. The repository

```sh
git clone git@github.com:ncfritz/olympus.git
```

Node and pnpm are needed only to build images or to write RabbitMQ's
definitions; a host that pulls its images from the registry needs
neither.

## 3. The environment

A host runs one environment, and environments are named where machines
are not ([ADR 0022](../decisions/0022-environments-not-machines.md)).
Use an existing `infra/docker/env/<env>.env` or write one: `DATA_DIR`,
`SECRETS_DIR`, `IMAGE_PREFIX` and the image tags, `STACKS` in start
order, `COMPOSE_PROFILES`, `LAN_BIND`, `MONITORING_NETWORK`.

```sh
infra/docker/stack.sh bootstrap <env>
```

This writes `env/.current` — which is how every later command knows what
this machine is — creates the shared networks and the data directories,
and creates the optional secrets empty. Nothing else works until it has
run.

## 4. Secrets

Every secret is a file in `${SECRETS_DIR}`, outside the repository. The
inventory is in `infra/docker/README.md`, _Secrets_; `bootstrap` creates
the optional ones, and these are the ones to write by hand:

- `postgres_password`
- `hasura_admin_secret`, `hasura_database_url`
- `minerva_auth_jwt_secret`, `minerva_oidc_providers` (with the `minerva`
  profile)
- `hasura_dev_admin_secret`, `hasura_dev_database_url` (only where
  `hasura-dev` runs)

**Generate passwords as hex.** A password containing `:`, `@`, `/`, `+`
or `=` has to be percent-encoded inside a connection string, and a URL
that doesn't get it does not fail — it authenticates as something else
and reports a password error for a user you never named.

Then RabbitMQ's users, which are generated rather than written:

```sh
infra/docker/stack.sh rabbitmq-users
```

Certificates go in `${SECRETS_DIR}/tls/<service>/`, issued per
[the certificates guide](certificates.md). The stacks start without them;
the API's 3443 listener and any agent on another machine do not.

## 5. Images

Either pull what the registry already has — set `IMAGE_PREFIX` and the
tags in the environment file — or build here.

**Build serially if memory is tight.** The bundles are minified, and
`bake` builds every target at once by default: `cannot allocate memory`
in a build step is the VM, not the disk.

**Check the tag is not older than the fixes you need.** In phase 4 the
pinned tag predated two fixes, and the stack running on it gave no sign,
because the services that would have broken were the ones not yet
started. A tag that runs what is up is not evidence that it runs what you
are about to start.

On the machine that _hosts_ the registry, build with `--load` rather than
`--push`: a container reaching its own host's published port is a hairpin
that Docker Desktop does not make work.

## 6. Data

**An empty machine** needs nothing: `stack.sh up data` creates the
database, and the Hasura image applies the repository's migrations and
metadata as it starts.

**Restoring onto an existing data directory** is different in two ways
that both bite.

`POSTGRES_PASSWORD_FILE` applies only to an _empty_ data directory. A
directory that already has a cluster keeps its own roles and passwords,
so that secret is for tools rather than for the server, and the role
Hasura connects as has to be set with `ALTER ROLE` on the running server.

A restored database already has the schema, so the baseline migration
must be recorded as applied before our image starts, or it tries to
create what is already there. `hdb_catalog.schema_migrations` does not
exist until migrations have run, so the row cannot simply be inserted:

```sh
hasura migrate apply --database-name olympus \
  --version <baseline> --skip-execution
```

Before starting any engine on restored data, check what the metadata says
its source connects to. A dump carries a _literal_ connection string if
the original had one, and an engine started on the copy will happily
connect itself to the original.

## 7. Up

```sh
infra/docker/stack.sh check        # every setting and secret in place
infra/docker/stack.sh up           # STACKS, in order
infra/docker/stack.sh ps <stack>
```

`check` reports a missing or empty secret per stack and says which of the
empty ones are optional. A service that starts before RabbitMQ or Hasura
is ready exits and its restart policy tries again, so a few restarts in
the first minute are normal; a service still restarting after that is
not.

## 8. nginx, and names

Only on a machine that terminates TLS. The host keeps its own
`nginx.conf` and its own sites; Olympus's server blocks come from the
checkout, which means `nginx.conf` needs

```
include /etc/nginx/olympus/*.conf;
```

inside its `http` block, and the certificates the blocks name have to
exist under `/config/ssl/`.

**Validate before recreating anything**, in a throwaway container against
the real files:

```sh
docker run --rm \
  -v <data>/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v <data>/nginx/config:/config:ro \
  -v <checkout>/infra/docker/nginx:/etc/nginx/olympus:ro \
  nginx:<version> nginx -t
```

`nginx -t` rejects the whole configuration for one bad directive, so a
single missing semicolon takes every site down rather than one. In phase
4 there was one.

Prefer a `resolver` and a `set $…` variable over an `upstream` block. A
name in an `upstream` must resolve when nginx _starts_: one service being
down then stops nginx from starting at all, instead of producing a 502
for that service alone.

## 9. The first user

The directory is empty, so nobody can sign in yet — signing in does not
create anyone (ADR 0018). Add yourself:

```
docker compose exec olympus-api node dist/authUser.js add you@example.com "Your Name" admin
```

See [the user directory](users.md) for the rest of the commands, and for
what to look at when a first sign-in links the wrong account.

## What tends to go wrong

From the two rehearsals, roughly in the order they were found:

| Symptom                                                 | Cause                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `FATAL: database "olympus" does not exist`              | a data directory created without `POSTGRES_DB`                                                              |
| Agents restart, `permission denied` reading a package   | build-context file modes reaching the runtime user; the deploy stage's `chmod -R a+rX`                      |
| Agents restart, `Cannot find module …/dist/…`           | a package whose own `.gitignore` excluded `dist` and which declared no `files`                              |
| Slow lookups, `EAI_AGAIN`, `fetch failed`               | the daemon's `dns` set to a list ending in public servers                                                   |
| A registry push that resolves but times out             | building on the registry's own host; use `--load`                                                           |
| `password authentication failed` for a role you did set | the secret's _name_ read as the role name, or an unencoded character in the connection URL                  |
| nginx will not start after a config change              | an `upstream` naming something that is down, or a directive missing its semicolon                           |
| A directory that plainly exists reported as missing     | an ACL (the `+` in `drwxrwxrwx+`) that does not name the container's uid; run as the uid that owns the data |
| `cannot allocate memory` in a build step                | production bundles minify; build targets serially or cap the builder's parallelism                          |

`packages/config/test/unit/packaging.spec.ts` now fails the build for the
`dist` case, and the Dockerfiles handle the file modes, so those two
should not recur. The rest are settings, and settings are what this guide
is for.
