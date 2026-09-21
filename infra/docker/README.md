# Docker

Planned contents (ADR 0011, ADR 0019, [plan](../../docs/plans/docker/README.md)):

- `docker-bake.hcl`: every image, its platform(s) and tags
- `compose/{data,rabbitmq,nginx,olympus}.yml`: one Compose project per
  stack; `prod` and `dev` run the same files
- `env/<host>.<env>.env`: the non-secret values that differ per host and
  environment; secrets are files in `${SECRETS_DIR}` on the host
- `stack.sh`: `bootstrap`, `check`, `up`, `down` per environment and stack
- `hasura/`, `rabbitmq/`: our images of those two
- Dockerfiles stay next to each app and use `turbo prune <app> --docker`

`compose/dev.yml` (Postgres and Hasura for the workspace) is replaced by
`data.yml` under a dev project in phase 3.
