#!/usr/bin/env bash
# Runs Olympus's Compose stacks on this host (ADR 0019). Bash 3.2 (macOS).
#
#   infra/docker/stack.sh bootstrap <env>     once: remember which
#                                             environment this machine is,
#                                             create networks and directories
#   infra/docker/stack.sh check [stack...]    every setting and secret in place
#   infra/docker/stack.sh up [stack...|all]   check, then start (in order)
#   infra/docker/stack.sh down [stack...|all] stop (in reverse order)
#   infra/docker/stack.sh pull|ps|logs|restart <stack> [args...]
#   infra/docker/stack.sh compose <stack> [args...]   anything else
#   infra/docker/stack.sh rabbitmq-users      write the RabbitMQ definitions
#
# An environment's settings are infra/docker/env/<env>.env (prod, local);
# its secrets are files in SECRETS_DIR. With DOCKER_CONTEXT set this drives
# another machine's Docker, except the nginx stack, which mounts files from
# the checkout.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
env_file_marker="$here/env/.current"

die() { echo "stack.sh: $*" >&2; exit 1; }

# Secrets a service can run without: an empty file means "not configured".
OPTIONAL_SECRETS="syno_smtp_password socks_proxy_username socks_proxy_password
content_ssh_password dionysus_cdn_ssh_password dionysus_library_ssh_password
nzbgeek_api_key nzbget_password tmdb_api_key google_oauth_client_secret"

is_optional() {
  case " $(printf '%s' "$OPTIONAL_SECRETS" | tr '\n' ' ') " in *" $1 "*) return 0 ;; esac
  return 1
}

known_envs() {
  local f
  for f in "$here"/env/*.env; do basename "$f" .env; done | tr '\n' ' '
}

load_env() {
  [ -f "$env_file_marker" ] || die "no environment yet: run 'stack.sh bootstrap <env>' (one of: $(known_envs))"
  OLYMPUS_ENV=$(cat "$env_file_marker")
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

  local net
  for net in olympus-data olympus-graphql olympus-backend olympus-edge "$MONITORING_NETWORK"; do
    if docker network inspect "$net" >/dev/null 2>&1; then
      echo "network  $net (exists)"
    else
      docker network create "$net" >/dev/null && echo "network  $net (created)"
    fi
  done

  local dir
  for dir in postgres rabbitmq/data registry \
    dionysus/uploads dionysus/asset-agents/data dionysus/metadata-agents/data \
    dionysus/search-agents/data minerva/credentials/google \
    minerva/credentials/microsoft olympus/site/olr; do
    mkdir -p "$DATA_DIR/$dir"
  done
  echo "data     $DATA_DIR"

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

check() {
  local list stack problems=0 name path
  list=$(stacks forward "$@")
  for stack in $list; do
    if ! compose "$stack" config --quiet 2>/tmp/stack-check.$$; then
      echo "$stack: $(cat /tmp/stack-check.$$)"
      problems=$((problems + 1))
      continue
    fi
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
  rm -f /tmp/stack-check.$$
  [ "$problems" -eq 0 ] || die "$problems problem(s)"
}

command=${1:-}
[ -n "$command" ] || { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
shift

case "$command" in
  bootstrap)
    bootstrap "$@"
    ;;
  check)
    load_env
    check "$@"
    ;;
  up)
    load_env
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
    die "unknown command '$command' (bootstrap, check, up, down, pull, ps, logs, restart, compose, rabbitmq-users)"
    ;;
esac
