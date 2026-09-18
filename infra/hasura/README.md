# Hasura

Not yet populated. The baseline is created from the running instance:

```sh
cd infra/hasura
hasura init . --endpoint http://localhost:8080 --admin-secret "$HASURA_ADMIN_SECRET"
hasura migrate create init --from-server --database-name default
hasura metadata export
```

After the baseline, every schema change is a migration in `migrations/` and
every metadata change is committed from `metadata/`. Deployments use the
`hasura/graphql-engine:<v2 version>.cli-migrations-v3` image, which applies
both on container start. See `docs/decisions/0005-schema-under-version-control.md`.
