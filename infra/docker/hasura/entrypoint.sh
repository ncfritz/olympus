#!/bin/sh
# Hasura reads its secrets only from the environment. Compose delivers
# them as files (ADR 0019), so for each variable below, NAME_FILE names a
# file whose contents become NAME. Then the image's own entrypoint, which
# applies migrations and metadata and starts the engine.
set -eu

for name in \
  HASURA_GRAPHQL_ADMIN_SECRET \
  HASURA_GRAPHQL_DATABASE_URL \
  HASURA_GRAPHQL_METADATA_DATABASE_URL
do
  eval "file=\${${name}_FILE:-}"
  [ -n "$file" ] || continue
  eval "value=\${${name}:-}"
  if [ -n "$value" ]; then
    echo "olympus-entrypoint: ${name} and ${name}_FILE are both set; use one" >&2
    exit 1
  fi
  if [ ! -r "$file" ]; then
    echo "olympus-entrypoint: ${name}_FILE: cannot read ${file}" >&2
    exit 1
  fi
  # $(...) drops the file's trailing newline.
  value=$(cat "$file")
  export "${name}=${value}"
  unset "${name}_FILE"
done

exec "${OLYMPUS_NEXT_ENTRYPOINT:-docker-entrypoint.sh}" "$@"
