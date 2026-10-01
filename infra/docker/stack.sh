#!/usr/bin/env bash
# Runs Olympus's Compose stacks on this host (ADR 0019). Bash 3.2 (macOS).
#
#   infra/docker/stack.sh bootstrap <env>     once: remember which
#                                             environment this machine is,
#                                             create networks and directories
#   infra/docker/stack.sh check [stack...]    every setting and secret in place
#   infra/docker/stack.sh list [stack...]     stacks and their containers, as a tree
#   infra/docker/stack.sh build (--push|--load) [--env <env>] [--parallel] <stack> [service...]
#                                             build this stack's images at HEAD,
#                                             one at a time (--parallel: all at
#                                             once); --env builds another
#                                             environment's from this machine
#   infra/docker/stack.sh up [--tag <tag>] [stack...|all]
#                                             check, then start (in order);
#                                             --tag runs that image tag
#                                             instead of OLYMPUS_TAG, this
#                                             once
#   infra/docker/stack.sh down [stack...|all] stop (in reverse order)
#   infra/docker/stack.sh nginx-reload [stack]  validate and reload the server
#                                             blocks (default nginx; `border`
#                                             for the public edge)
#   infra/docker/stack.sh pull|ps|logs|restart <stack> [args...]
#                                             (pull takes --tag too)
#   infra/docker/stack.sh compose <stack> [args...]   anything else
#   infra/docker/stack.sh rabbitmq-users      write the RabbitMQ definitions
#   infra/docker/stack.sh refresh-dev [<date>] [--yes]
#                                             rebuild olympus_dev from a
#                                             nightly archive
#
# An environment's settings are infra/docker/env/<env>.env (prod, local);
# its secrets are files in SECRETS_DIR. With DOCKER_CONTEXT set this drives
# another machine's Docker, except the nginx stack, which mounts files from
# the checkout.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
env_file_marker="$here/env/.current"

die() { echo "stack.sh: $*" >&2; exit 1; }

# Olympus's own networks and the subnet each is created with. Docker allocates
# from `172.17.0.0/12` in /16s and then, once that pool is gone, from
# **`192.168.0.0/16` in /20s** -- and the first of those is 192.168.0.0/20,
# which is 192.168.0.0 through 192.168.15.255. A host running a dozen other
# stacks exhausts the first pool, so a network created without a subnet lands
# on top of a home LAN in 192.168.x. The route then lives in Docker's VM
# rather than in any one container, so *every* container on the host loses the
# LAN while keeping the internet, and it arrives as a connect timeout with no
# packet ever reaching the destination. Naming the subnets makes this a
# property of this repository instead of a property of how many networks the
# host happens to have. 10.210/16 because the host's other stacks are in
# 172.16/12 and the LAN is in 192.168/16.
#
# $MONITORING_NETWORK is deliberately absent: in prod it is another stack's
# network (grafana_grafana_net) that Olympus only joins, so its subnet is not
# ours to choose.
NETWORK_SUBNETS="olympus-data:10.210.1.0/24
olympus-graphql:10.210.2.0/24
olympus-backend:10.210.3.0/24
olympus-edge:10.210.4.0/24"

subnet_for() {
  local line
  while IFS= read -r line; do
    case "$line" in "$1:"*) printf '%s' "${line#*:}"; return 0 ;; esac
  done <<EOF
$NETWORK_SUBNETS
EOF
  return 1
}

# Secrets a service can run without: an empty file means "not configured".
OPTIONAL_SECRETS="syno_smtp_password socks_proxy_username socks_proxy_password
content_ssh_password dionysus_cdn_ssh_password dionysus_library_ssh_password
nzbgeek_api_key nzbget_password tmdb_api_key google_oauth_client_secret
minerva_oidc_providers olympus_oidc_providers"

is_optional() {
  case " $(printf '%s' "$OPTIONAL_SECRETS" | tr '\n' ' ') " in *" $1 "*) return 0 ;; esac
  return 1
}

known_envs() {
  local f
  for f in "$here"/env/*.env; do basename "$f" .env; done | tr '\n' ' '
}

# This machine's environment, or one named explicitly. The two differ when
# building images for an environment this machine does not run: the laptop
# runs `local` and builds production's images, which is the whole point of
# environments being named rather than being machines (ADR 0022).
load_env() {
  local named=${1:-}
  if [ -n "$named" ]; then
    OLYMPUS_ENV=$named
  else
    [ -f "$env_file_marker" ] || die "no environment yet: run 'stack.sh bootstrap <env>' (one of: $(known_envs))"
    OLYMPUS_ENV=$(cat "$env_file_marker")
  fi
  ENV_FILE="$here/env/$OLYMPUS_ENV.env"
  [ -f "$ENV_FILE" ] || die "no $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

compose() {
  local stack=$1
  shift
  [ -f "$here/compose/$stack.yml" ] || die "no stack '$stack' (compose/$stack.yml)"
  docker compose -f "$here/compose/$stack.yml" --env-file "$ENV_FILE" "$@"
}

# The stacks named, or STACKS for "all" or none; reversed for down.
stacks() {
  local order=$1
  shift
  local list="$*"
  if [ -z "$list" ] || [ "$list" = all ]; then list=$STACKS; fi
  if [ "$order" = reverse ]; then
    echo "$list" | tr ' ' '\n' | sed '1!G;h;$!d' | tr '\n' ' '
  else
    echo "$list"
  fi
}

bootstrap() {
  local name=${1:-}
  [ -n "$name" ] || die "usage: stack.sh bootstrap <env> (one of: $(known_envs))"
  [ -f "$here/env/$name.env" ] || die "no env/$name.env"
  echo "$name" > "$env_file_marker"
  load_env

  local net want have
  for net in olympus-data olympus-graphql olympus-backend olympus-edge "$MONITORING_NETWORK"; do
    want=$(subnet_for "$net" || true)
    if docker network inspect "$net" >/dev/null 2>&1; then
      have=$(docker network inspect \
        -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$net" 2>/dev/null)
      have=${have% }
      if [ -n "$want" ] && [ "$have" != "$want" ]; then
        echo "network  $net (exists on $have, wanted $want)"
        case "$have" in 192.168.*)
          echo "         192.168.x is where home LANs live, and a Docker network"
          echo "         over the LAN's own range takes the LAN away from every"
          echo "         container on this host -- not just the ones on it." ;;
        esac
        echo "         Left as it is. To move it: stop the stacks using it,"
        echo "         \`docker network rm $net\`, then bootstrap again."
      else
        echo "network  $net (exists)"
      fi
    elif [ -n "$want" ]; then
      docker network create --subnet "$want" "$net" >/dev/null \
        && echo "network  $net (created, $want)"
    else
      docker network create "$net" >/dev/null && echo "network  $net (created)"
    fi
  done

  local dir
  for dir in postgres rabbitmq/data registry registry-ui \
    dionysus/uploads dionysus/asset-agents/data dionysus/metadata-agents/data \
    dionysus/search-agents/data minerva/credentials/google \
    minerva/credentials/microsoft olympus/site/olr; do
    mkdir -p "$DATA_DIR/$dir"
  done
  echo "data     $DATA_DIR"
  # Where the nightly DAG writes (infra/airflow). Created here because Docker
  # refuses a bind mount whose source is missing, so the first run would fail.
  mkdir -p "${BACKUP_DIR:-$DATA_DIR/backups}"
  echo "backups  ${BACKUP_DIR:-$DATA_DIR/backups}"

  mkdir -p "$SECRETS_DIR/rabbitmq"
  chmod 700 "$SECRETS_DIR"
  for dir in olympus-api olympus-notification-agent dionysus-asset-agent \
    dionysus-metadata-agent dionysus-search-agent; do
    mkdir -p "$SECRETS_DIR/tls/$dir"
  done
  local name
  for name in $OPTIONAL_SECRETS; do
    [ -e "$SECRETS_DIR/$name" ] || { : > "$SECRETS_DIR/$name"; chmod 600 "$SECRETS_DIR/$name"; }
  done
  echo "secrets  $SECRETS_DIR (optional ones created empty)"
  echo
  echo "Next: put the required secrets in $SECRETS_DIR (infra/docker/README.md,"
  echo "Secrets), run 'stack.sh rabbitmq-users', then 'stack.sh check'."
}

# The secret files the stack's enabled services mount: "name<TAB>path".
secret_files() {
  compose "$1" config --format json | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const c = JSON.parse(s), used = new Set();
      for (const svc of Object.values(c.services ?? {}))
        for (const x of svc.secrets ?? []) used.add(x.source);
      for (const [name, def] of Object.entries(c.secrets ?? {}))
        if (used.has(name)) console.log(name + "\t" + def.file);
    });'
}

# Every service a stack defines, with the state of its container. A service
# with no container is shown too: "what is this stack meant to run" is as
# useful as "what is running", and only listing containers hides a stack that
# is down.
list_stacks() {
  local stack config ps
  for stack in $(stacks forward "$@"); do
    if ! config=$(compose "$stack" config --format json 2>&1); then
      printf '%s\n    (cannot read: %s)\n' "$stack" "$(printf '%s' "$config" | head -1)"
      continue
    fi
    # `ps -a`, so a container that exited is visible rather than absent --
    # a crash loop looks exactly like "not started" otherwise.
    ps=$(compose "$stack" ps -a --format json 2>/dev/null || true)
    # The script is single-quoted so the shell leaves it alone: every $ in it
    # belongs to JavaScript. What node needs is passed as environment.
    # shellcheck disable=SC2016
    printf '%s' "$config" | STACK="$stack" PS="$ps" node -e '
      let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
        const services = Object.keys(JSON.parse(s).services ?? {}).sort();
        // Compose has emitted both a JSON array and one object per line,
        // depending on its version. Accept either.
        const raw = process.env.PS || "";
        let rows;
        try {
          rows = JSON.parse(raw);
          if (!Array.isArray(rows)) rows = [rows];
        } catch {
          rows = raw.split("\n").filter(Boolean).flatMap((line) => {
            try { return [JSON.parse(line)]; } catch { return []; }
          });
        }
        const byService = new Map(rows.map((r) => [r.Service, r]));
        const running = rows.filter((r) => r.State === "running").length;
        console.log(`${process.env.STACK}  (${running}/${services.length} running)`);
        services.forEach((name, i) => {
          const row = byService.get(name);
          // The tag it is actually running, which is the thing a deploy gets
          // wrong: OLYMPUS_TAG says what should be there, this says what is.
          const tag = row?.Image?.includes(":") ? row.Image.split(":").pop() : "";
          const status = row ? row.Status : "not created";
          const branch = i === services.length - 1 ? "└──" : "├──";
          console.log(
            `${branch} ${name.padEnd(28)}${status.padEnd(26)}${tag}`.trimEnd(),
          );
        });
      });'
  done
}

# The bake targets behind a stack's services, from each service's own image
# name -- which is what docker-bake.hcl calls its targets. Derived rather
# than kept as a table of service -> target, because a table is a second
# place to forget a service.
build_targets() {
  local stack=$1 config
  shift
  # Captured, not piped: a stack whose settings are incomplete makes `compose
  # config` fail, and piping nothing into node produces a JavaScript stack
  # trace where a sentence belongs.
  config=$(compose "$stack" config --format json 2>&1) ||
    die "$stack: $(printf '%s' "$config" | head -1)"
  # As above: single-quoted for node, not for the shell.
  # shellcheck disable=SC2016
  printf '%s' "$config" | STACK="$stack" WANTED="$*" node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const services = Object.entries(JSON.parse(s).services ?? {});
      const wanted = (process.env.WANTED || "").split(" ").filter(Boolean);
      const missing = wanted.filter((w) => !services.some(([n]) => n === w));
      if (missing.length) {
        // Passing an image target where a service goes is an easy slip: the
        // site is service `olympus-site` and target `site`. Say so rather than
        // just refusing.
        const named = (w) => {
          const hit = services.find(([, svc]) =>
            new RegExp(`(?:^|/)olympus/${w.replace(/[^\w-]/g, "")}:`).test(
              String(svc.image ?? ""),
            ),
          );
          return hit ? `${w} (the image target; its service is ${hit[0]})` : w;
        };
        console.error(
          `no such service in ${process.env.STACK}: ${missing.map(named).join(", ")}`,
        );
        process.exit(1);
      }
      const chosen = wanted.length
        ? services.filter(([n]) => wanted.includes(n))
        : services;
      const ours = [], theirs = [];
      for (const [name, service] of chosen) {
        const image = String(service.image ?? "");
        // <registry>/olympus/<name>:<tag>, or olympus/<name>:<tag> with no
        // registry: the <name> is the bake target.
        const match = /^(?:.*\/)?olympus\/([^/:]+):/.exec(image);
        if (match) ours.push(match[1]);
        else theirs.push(`${name} (${image || "no image"})`);
      }
      // Postgres, the registry, nginx: nothing here builds them.
      if (theirs.length && wanted.length) {
        console.error(`not ours, nothing to build: ${theirs.join(", ")}`);
      }
      console.log([...new Set(ours)].join(" "));
    });'
}

build() {
  local output="" dirty="" env_name="" stack="" services="" passthru="" parallel=""
  local root registry tag revision builder=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --push | --load) output=${1#--} ;;
      --dirty) dirty=yes ;;
      --parallel) parallel=yes ;;
      --env)
        shift
        env_name=${1:-}
        [ -n "$env_name" ] || die "--env needs a name (one of: $(known_envs))"
        ;;
      --) shift; passthru="$*"; break ;;
      -*) die "unknown option '$1' (--push, --load, --dirty, --env, --parallel)" ;;
      *) if [ -z "$stack" ]; then stack=$1; else services="$services $1"; fi ;;
    esac
    shift
  done

  # After the flags, because --env decides which one.
  load_env "$env_name"

  # No default, deliberately. --load puts the image in the local store, which
  # is what the Compose services on that machine pull from and the right
  # answer on the host that also hosts the registry -- a push from there is a
  # round trip out and back through nginx. --push is the only thing that
  # reaches another machine, which the NAS's asset agent needs. Guessing
  # either way is silently wrong half the time.
  [ -n "$output" ] || die "build needs --push or --load (see infra/docker/README.md, Building images)"
  [ -n "$stack" ] || die "usage: stack.sh build (--push|--load) <stack> [service...] [-- bake args]"

  root=$(cd "$here/../.." && pwd)
  # The tag is the commit, and a rollback sets OLYMPUS_TAG back to one. An
  # image built from a dirty tree and tagged with a clean commit's sha is a
  # lie that only shows up when someone rolls back to it.
  if [ -z "$dirty" ] && [ -n "$(git -C "$root" status --porcelain)" ]; then
    die "the tree has uncommitted changes: commit them, or pass --dirty to tag this build with $(git -C "$root" rev-parse --short HEAD) anyway"
  fi
  tag=$(git -C "$root" rev-parse --short HEAD)
  revision=$(git -C "$root" rev-parse HEAD)

  # docker-bake.hcl names images <REGISTRY>/olympus/<target>, so the registry
  # is whatever IMAGE_PREFIX has before that.
  case "$IMAGE_PREFIX" in
    olympus) registry="" ;;
    */olympus) registry=${IMAGE_PREFIX%/olympus} ;;
    *) die "IMAGE_PREFIX is '$IMAGE_PREFIX'; docker-bake.hcl builds <registry>/olympus/<name>" ;;
  esac
  [ -n "$registry" ] || [ "$output" = load ] ||
    die "the '$OLYMPUS_ENV' environment's IMAGE_PREFIX names no registry, so there is nowhere to --push. To build another environment's images from this machine: stack.sh build --push --env prod $stack"

  local targets
  # Split on purpose: each service name is its own argument, and this script
  # is bash 3.2, so a list is a string rather than an array.
  # shellcheck disable=SC2086
  targets=$(build_targets "$stack" $services) || exit 1
  [ -n "$targets" ] || die "$stack has no images this repository builds"

  # Two platforms cannot be loaded into one image store, so a --load of a
  # multi-platform target needs `-- --set <target>.platform=linux/arm64`.
  [ "$output" = load ] || builder="--builder olympus"

  echo "== $stack: $targets"
  echo "   $OLYMPUS_ENV, tag $tag${registry:+, registry $registry}, --$output${parallel:+, in parallel}"
  # One bake per image by default. A bake of several targets builds them
  # all at once, and a few Node builds side by side exhaust Docker
  # Desktop's memory ("cannot allocate memory"). Layers are shared through
  # the builder's cache either way, so one at a time costs little more
  # than the slowest image. --parallel is the single bake.
  local target
  # shellcheck disable=SC2086
  if [ -n "$parallel" ]; then
    bake "$root" "$registry" "$tag" "$revision" "$builder" "$output" "$passthru" $targets
  else
    for target in $targets; do
      echo "-- $target"
      bake "$root" "$registry" "$tag" "$revision" "$builder" "$output" "$passthru" "$target" ||
        die "$target failed to build; the images before it are built${output:+ (--$output)}"
    done
  fi
}

# One `docker buildx bake` of the targets given, from the repository root.
bake() {
  local root=$1 registry=$2 tag=$3 revision=$4 builder=$5 output=$6 passthru=$7
  shift 7
  # shellcheck disable=SC2086
  (
    cd "$root" &&
      REGISTRY="$registry" TAG="$tag" GIT_REVISION="$revision" \
        docker buildx bake $builder "--$output" "$@" $passthru
  )
}

# nginx serves its Olympus server blocks from the checkout, so editing one
# changes nothing a `compose up` can see: the service definition is identical
# and the running nginx keeps the config it parsed at start. Reloading is the
# operation, and `-t` comes first because this nginx serves every site on the
# host -- reloading a broken config takes all of them down, not just the one
# that was edited.
# Validate, then reload: never the other way round, and never a reload without
# the validation. `nginx -s reload` on a bad configuration leaves the old one
# running and says nothing, so the next restart is when you find out.
# psql as the superuser inside the running Postgres. The local socket is
# trusted there, so no password is needed and none is passed.
psql_postgres() {
  compose data exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres "$@"
}

# Rebuilds olympus_dev from a production archive (docs/plans/docker/README.md,
# phase 6, and ADR 0019: that database exists to be a copy of production).
#
# By hand, never on a schedule. hasura-dev keeps its metadata *in* olympus_dev,
# so this destroys whatever schema change was being tried there -- including
# anything edited in its console and never exported to infra/hasura/metadata.
#
# It ends by starting hasura-dev, and that is the interesting part: the image
# carries migrations and metadata and its entrypoint applies them on start
# (infra/docker/hasura), so no CLI step is needed here and a run proves both
# halves -- that the archive restores, and that what is committed still applies
# to what came out of it.
#
# The archive is piped in over stdin rather than mounted, so nothing has to be
# visible to the Postgres container; it does have to be visible to this shell,
# which means running this on the host that holds the archives.
refresh_dev() {
  local when="" yes=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --yes) yes=1 ;;
      -*) die "refresh-dev: unknown option $1" ;;
      *) [ -z "$when" ] || die "refresh-dev: one date, not two"; when=$1 ;;
    esac
    shift
  done

  local backups="${BACKUP_DIR:-$DATA_DIR/backups}"
  [ -d "$backups" ] || die "no $backups -- either the nightly DAG has not run
(infra/airflow) or this is not the host holding the archives"
  if [ -z "$when" ] || [ "$when" = latest ]; then
    when=$(ls -1 "$backups" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' | sort | tail -1)
    [ -n "$when" ] || die "no dated archive in $backups"
  fi
  local archive="$backups/$when/olympus.dump"
  [ -f "$archive" ] || die "no $archive"

  # Roles live outside every database, so a database with no role to own it is
  # a restore that fails halfway. globals.sql in the archive is where it is.
  psql_postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'olympus_dev'" \
    | grep -q 1 || die "no olympus_dev role -- create it first; the archive's
globals.sql has the one production uses"

  if [ -z "$yes" ]; then
    echo "This drops olympus_dev and rebuilds it from $when."
    echo "hasura-dev keeps its metadata in that database: anything tried in its"
    echo "console and not exported to infra/hasura/metadata is lost."
    printf 'Type the date to continue: '
    local answer
    read -r answer
    [ "$answer" = "$when" ] || die "not confirmed"
  fi

  echo "== hasura-dev down"
  compose hasura-dev down

  echo "== olympus_dev"
  # A drop needs no connections at all, and the engine is not the only thing
  # that may have one -- a console left open in a browser reconnects.
  psql_postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = 'olympus_dev' AND pid <> pg_backend_pid()" > /dev/null
  psql_postgres -c "DROP DATABASE IF EXISTS olympus_dev"
  psql_postgres -c "CREATE DATABASE olympus_dev OWNER olympus_dev"

  echo "== restore $when"
  # --no-owner with --role: everything is created as olympus_dev and owned by
  # it, whatever owned it in production.
  if ! compose data exec -T postgres pg_restore -U postgres -d olympus_dev \
    --no-owner --role=olympus_dev --no-privileges < "$archive"; then
    die "pg_restore reported errors -- which is this drill failing, not noise;
the output above says what it could not restore"
  fi

  echo "== hasura-dev up"
  compose hasura-dev up -d --remove-orphans
  cat <<'NEXT'

hasura-dev is applying migrations and metadata from its image now. What to look
at, in order:

  stack.sh logs hasura-dev -f
  cd infra/hasura && hasura migrate status --database-name olympus
  cd infra/hasura && hasura metadata diff

A diff there is drift between this repository and the metadata production was
running, which is worth knowing either way: a deploy applies the repository's
copy over production's, so drift is work about to be overwritten.
NEXT
}

nginx_reload() {
  local stack=${1:-nginx}
  compose "$stack" exec -T nginx nginx -t
  compose "$stack" exec -T nginx nginx -s reload
  echo "$stack: reloaded"
}

check() {
  local list stack problems=0 name path output remote=""
  list=$(stacks forward "$@")
  # Secret paths and bind mounts are resolved on the Docker *host*. Driving
  # another machine's Docker, this shell cannot see them, and reporting them
  # missing would be a lie that sends someone to copy files that are already
  # there. Say so instead. (A context selected with `docker context use`
  # rather than these variables is not visible from here.)
  [ -z "${DOCKER_CONTEXT:-}${DOCKER_HOST:-}" ] || remote=yes
  for stack in $list; do
    [ -z "$remote" ] ||
      echo "$stack: on another machine's Docker; secret files not checked here"
    # Capture the output instead of redirecting it to a file. `compose` can
    # `die` in here — an unknown stack, a missing compose file — and `die`
    # writes to stderr and exits, so with stderr going to a file the message
    # was written somewhere nothing read and the script exited 1 in silence.
    # A command substitution is a subshell, so that exit lands here.
    if ! output=$(compose "$stack" config --quiet 2>&1); then
      echo "$stack: $output"
      problems=$((problems + 1))
      continue
    fi
    [ -z "$remote" ] || { echo "$stack: checked"; continue; }
    while IFS="$(printf '\t')" read -r name path; do
      [ -n "$name" ] || continue
      if [ ! -e "$path" ]; then
        echo "$stack: missing secret $name ($path)"
        problems=$((problems + 1))
      elif [ ! -s "$path" ]; then
        if is_optional "$name"; then
          echo "$stack: $name is empty; the service runs without it"
        else
          echo "$stack: empty secret $name ($path)"
          problems=$((problems + 1))
        fi
      fi
    done < <(secret_files "$stack")
    echo "$stack: checked"
  done
  [ "$problems" -eq 0 ] || die "$problems problem(s)"
}

# `--tag <tag>` (or `--tag=<tag>`) anywhere in the arguments: the image tag
# of the images this repository builds (OLYMPUS_TAG), for this run only, so
# a fix can be deployed without editing the env file. Run after load_env,
# which sets OLYMPUS_TAG from it; Compose prefers the shell's value to the
# env file's. Leaves the other arguments in ARGS: stack names and the
# Compose arguments passed through never contain spaces.
tag_option() {
  local tag=""
  ARGS=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --tag)
        shift
        tag=${1:-}
        [ -n "$tag" ] || die "--tag needs an image tag, e.g. a commit's short sha"
        ;;
      --tag=*)
        tag=${1#--tag=}
        [ -n "$tag" ] || die "--tag needs an image tag, e.g. a commit's short sha"
        ;;
      *) ARGS="$ARGS $1" ;;
    esac
    shift
  done
  [ -n "$tag" ] || return 0
  # Docker's own rule for a tag, so a typo fails here rather than as a pull
  # of something that cannot exist.
  printf '%s' "$tag" | grep -Eq '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$' ||
    die "--tag '$tag' is not an image tag"
  echo "OLYMPUS_TAG=$tag for this run (env/$OLYMPUS_ENV.env has ${OLYMPUS_TAG:-none})" >&2
  OLYMPUS_TAG=$tag
  export OLYMPUS_TAG
}

# The header, to the first line that is not a comment. Not a line range: one
# went stale the moment this file grew, and the help then stopped mid-sentence.
usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
}

command=${1:-}
[ -n "$command" ] || { usage; exit 2; }
shift

case "$command" in
  bootstrap)
    bootstrap "$@"
    ;;
  check)
    load_env
    check "$@"
    ;;
  list)
    load_env
    list_stacks "$@"
    ;;
  build)
    build "$@"
    ;;
  nginx-reload)
    load_env
    nginx_reload "$@"
    ;;
  refresh-dev)
    load_env
    refresh_dev "$@"
    ;;
  up)
    load_env
    tag_option "$@"
    # Split on purpose: ARGS is a list of stack names (bash 3.2, no arrays).
    # shellcheck disable=SC2086
    set -- $ARGS
    check "$@"
    for stack in $(stacks forward "$@"); do
      echo "== $stack"
      compose "$stack" up -d --remove-orphans
    done
    ;;
  down)
    load_env
    for stack in $(stacks reverse "$@"); do
      echo "== $stack"
      compose "$stack" down
    done
    ;;
  pull | ps | logs | restart)
    load_env
    if [ "$command" = pull ]; then
      tag_option "$@"
      # shellcheck disable=SC2086
      set -- $ARGS
    fi
    stack=${1:-}
    [ -n "$stack" ] || die "usage: stack.sh $command <stack> [args...]"
    shift
    compose "$stack" "$command" "$@"
    ;;
  compose)
    load_env
    stack=${1:-}
    [ -n "$stack" ] || die "usage: stack.sh compose <stack> [args...]"
    shift
    compose "$stack" "$@"
    ;;
  rabbitmq-users)
    load_env
    node "$here/rabbitmq/definitions.mjs" "$SECRETS_DIR" --generate-missing
    ;;
  *)
    die "unknown command '$command' (bootstrap, check, list, build, up, down, nginx-reload, pull, ps, logs, restart, compose, rabbitmq-users)"
    ;;
esac
