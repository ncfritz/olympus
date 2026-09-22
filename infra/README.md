# infra/

| Directory | Contents                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `hasura/` | Hasura v2 project: `migrations/` and `metadata/` under version control (ADR 0004, 0005)                         |
| `docker/` | Dockerfiles, compose files, env files and secrets tooling (ADR 0011, 0019); the bake file is `/docker-bake.hcl` |

## Reverse proxy (nginx)

The site calls the API under `/api`, and nginx strips that prefix. Tell the
API about it so the `Location` headers of created resources carry it
(`/api/v1/...` instead of `/v1/...`):

```nginx
location /api/ {
    proxy_pass http://olympus-api:3100/;
    proxy_set_header X-Forwarded-Prefix /api;
}
```

Without the header the API answers with its own paths (`/v1/...`), which is
what direct callers such as the agents need.
