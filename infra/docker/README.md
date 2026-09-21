# Docker

Planned contents (ADR 0011, ADR 0019, [plan](../../docs/plans/docker/README.md)):

- `docker-bake.hcl`: every image, its platform(s) and tags
- `compose/{data,rabbitmq,nginx,olympus}.yml`: one Compose project per
  stack; the Mac Mini and the dev laptop run the same files
- `env/<host>.env`: the non-secret values that differ per host; secrets
  are files in `${SECRETS_DIR}` on the host
- `stack.sh`: `bootstrap`, `check`, `up`, `down` per stack
- `hasura/`: our Hasura image, carrying the migrations and metadata
- Dockerfiles stay next to each app and use `turbo prune <app> --docker`

`compose/dev.yml` (Postgres and Hasura for the workspace) is replaced by
`data.yml` with the laptop's env file in phase 3.
