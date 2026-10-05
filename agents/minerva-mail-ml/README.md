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

Today (phase 0) it serves `/health` and `/metrics`, nothing else.

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

| Variable      | What                                | Default           |
| ------------- | ----------------------------------- | ----------------- |
| `LISTEN_PORT` | `/health`, `/metrics`               | `3106`            |
| `LOG_LEVEL`   | `debug`, `info`, `warning`, `error` | `info`            |
| `ENVIRONMENT` | Labels the logs                     | `development`     |
| `APP_NAME`    | The service's name                  | `minerva-mail-ml` |
