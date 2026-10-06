# minerva-mail-ml

Minerva mail's classifier
([ADR 0030](../../docs/decisions/0030-email-management.md),
[the plan](../../docs/plans/email-management/README.md)): it turns a
message's text into features, keeps them in its own store, suggests labels,
learns from every reviewed decision, and runs the audit's analyses. The
mail agent (`agents/minerva-mail`) sends it text in memory; it never stores
the text, and it reaches the platform only through the API.

It is the repository's one Python service, outside pnpm and Turborepo; its
conventions are [docs/conventions/python.md](../../docs/conventions/python.md).

It has two listeners. The plain one serves `/health` and `/metrics`. The
services one, mutual TLS, is the only way text arrives: a client
certificate from the services issuer, and only the services in
`SERVICES_ALLOWED_CLIENTS` (the mail agent), checked as each connection
opens.

| Route                        | What                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| `POST /v1/features`          | A batch of up to 500 messages' text, featurized and stored      |
| `POST /v1/features/complete` | Marks a feature version built: it serves from then on           |
| `GET /v1/features/versions`  | The versions in the store, their messages, and which one serves |

The feature store is SQLite (`FEATURE_STORE_PATH`): per feature version,
each message's hashed token counts (subject, the body's first 5,000
characters, sender, list, attachments) and the sender and list beside
them. No text. A new version builds beside the old, which serves until the
new one is complete.

## Working on it

```sh
cd agents/minerva-mail-ml
uv sync --group dev              # .venv from uv.lock
uv run ruff check . && uv run ruff format --check .
uv run pytest
cp dev.env.example dev.env
uv run --env-file dev.env minerva-mail-ml
```

## The image

```sh
docker buildx bake --load minerva-mail-ml    # from the repository root
```

## Configuration

| Variable                   | What                                                 | Default                 |
| -------------------------- | ---------------------------------------------------- | ----------------------- |
| `LISTEN_PORT`              | `/health`, `/metrics`                                | `3106`                  |
| `SERVICES_LISTEN_PORT`     | The services listener                                | `3107`                  |
| `TLS_CERT`, `TLS_KEY`      | Its certificate (all four TLS settings, or none)     | (no services listener)  |
| `TLS_CA_SERVICES`          | The services chain it trusts                         |                         |
| `SERVICES_ISSUER`          | The issuing CA's common name a client must come from |                         |
| `TLS_CRL_SERVICES`         | Revocation lists, comma-separated: one per authority | (none)                  |
| `SERVICES_ALLOWED_CLIENTS` | Services let in, by certificate common name          | `minerva-mail-agent`    |
| `FEATURE_STORE_PATH`       | The feature store                                    | `data/features.sqlite3` |
| `LOG_LEVEL`                | `debug`, `info`, `warning`, `error`                  | `info`                  |
| `ENVIRONMENT`              | Labels the logs                                      | `development`           |
| `APP_NAME`                 | The service's name                                   | `minerva-mail-ml`       |
