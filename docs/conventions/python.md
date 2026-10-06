# Python conventions (`agents/minerva-mail-ml`)

The classifier for Minerva mail
([ADR 0030](../decisions/0030-email-management.md)) is the repository's
one Python service: scikit-learn, River, cleanlab and HDBSCAN have no
TypeScript equivalents worth using. Everything else stays TypeScript. The
Airflow DAGs in `infra/airflow` are Python too but are not a service; they
follow their own README.

A Python service follows the agent conventions ([agent.md](agent.md)) in
spirit: typed configuration read in one place, structured logs, metrics,
the platform reached only through the API, private working state allowed.
This page is how that is done in Python.

## Toolchain

| What         | Choice                                                         |
| ------------ | -------------------------------------------------------------- |
| Python       | 3.13, pinned in `requires-python` and the image                |
| Dependencies | `uv`: `pyproject.toml`, and `uv.lock` committed                |
| Lint, format | `ruff check` and `ruff format`, configured in `pyproject.toml` |
| Tests        | `pytest`, under `tests/`                                       |
| HTTP         | FastAPI on uvicorn                                             |
| Metrics      | `prometheus-client`, mounted at `/metrics`                     |

The service is outside pnpm's workspace and Turborepo's graph, and
Prettier and ESLint do not read it. `uv run ruff check .`,
`uv run ruff format --check .` and `uv run pytest` are its checks; run them
before calling work done, as the Turbo tasks are for the rest.

## Layout

```
agents/<name>/
  pyproject.toml           project, dependencies, ruff and pytest settings
  uv.lock                  committed
  Dockerfile               the image; this directory is its build context
  dev.env.example          copy to dev.env (git-ignored)
  src/<package>/
    __main__.py            validates config, sets up logging, runs uvicorn
    config.py              read_config(): every environment variable, here only
    app.py                 create_app(config): routes, /health, /metrics
    <feature>/             e.g. features/, training/, audit/
      cli.py               a command of the feature's own, if it has one
  tests/                   mirrors src/<package>/
```

- Modules and packages are `snake_case`; one feature per package.
- Code under `src/`, tests under `tests/`, never mixed.
- Work that runs on a schedule rather than per request is a command
  (`[project.scripts]`, `argparse`) in the same image, started by Airflow
  with the service's volume, not a route: the service only reads what it
  writes. Its output goes to `sys.stdout.write` or the log.

## Configuration

- `config.py` reads every variable into a frozen dataclass; `os.environ`
  is read nowhere else.
- Every invalid or missing variable is reported at once (`ConfigError`
  with the list), and `__main__` exits before anything starts, as
  `readConfig()` does for the Node services.
- Secrets arrive as `NAME_FILE` (ADR 0019) and are read from the file in
  `config.py`. No secret in source, logs or the image.

## Logging and errors

- The `logging` module, one logger per module
  (`logging.getLogger(__name__)`); `print` is refused by ruff (`T20`).
- Never log message text, a snippet, or anything derived from a body
  that could be read back (ADR 0030). Log IDs and counts.

## Talking to the platform

- Only through the Olympus API, over HTTPS with the service's client
  certificate (ADR 0018, 0023). Never Hasura or Postgres for platform
  data.
- Requests into the service arrive on a **services listener** of their
  own: mutual TLS against the services chain and its revocation lists,
  and, since the handshake does not say which service it is, the client
  certificate's issuer and common name checked as the connection opens
  (`tls.py`; uvicorn does not hand the certificate to the app). Every
  route that takes text is on it and nowhere else; the plain listener
  serves `/health` and `/metrics` only.
- A validation error says where and why, never what: FastAPI's default
  answer repeats the refused input, which could be a message's text.

## Data

- Private working state goes in the service's own store on its volume
  (for the classifier, SQLite databases: the features, and the model
  runs with their evaluation, a row per label rather than a JSON
  document, ADR 0007). It is derived data, rebuilt
  from its sources, and not backed up.
- Message text exists only in memory, for the length of a request. It is
  not written to the store, a temporary file, a log or an exception
  message.

## Tests

- `pytest`, with FastAPI's `TestClient` for routes, and
  `httpx.MockTransport` for calls to the API. Warnings are errors
  in review: `uv run pytest -W error` should pass.
- Unit tests for configuration and every feature; fixtures are small and
  synthetic, never real mail.

## Images

- One Dockerfile in the service's directory, multi-stage: `uv sync
--frozen --no-dev` into a virtualenv, copied into a slim runtime that
  runs as a non-root user, with a `HEALTHCHECK` on `/health`.
- A target in `/docker-bake.hcl`, built centrally with the others (ADR
  0011).
