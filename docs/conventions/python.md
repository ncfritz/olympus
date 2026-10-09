# Python conventions

TypeScript is the rule. Two services are the exceptions, each for a
library TypeScript has no equal for:

- `apps/harpocrates/signer`
  ([ADR 0020](../decisions/0020-internal-certificate-authority.md)):
  Python's `cryptography` is ahead for the revocation lists, PKCS#12 and
  OCSP the CA depends on. It is kept small enough to read in a sitting:
  it holds the keys and signs, and decides nothing the service can
  decide.
- `agents/minerva-mail-ml`, the classifier for Minerva mail
  ([ADR 0030](../decisions/0030-email-management.md)): scikit-learn,
  River, cleanlab and HDBSCAN have no TypeScript equivalents worth using.

The Airflow DAGs in `infra/airflow` are Python too but are not a service;
they follow their own README.

A Python service follows the agent conventions ([agent.md](agent.md)) in
spirit: typed configuration read in one place, structured logs, the
platform reached only through the API, private working state allowed.
This page is how that is done in Python. Where the two services differ,
it says which does what; a new service follows the signer's shape (in
Turbo's graph, Pyright, `test/`) unless it has a reason not to.

## Toolchain

| Tool                                            | Does                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| Python 3.13                                     | pinned in `requires-python` and the image                 |
| [uv](https://docs.astral.sh/uv/)                | Python version, the environment, dependencies, `uv.lock`  |
| [Ruff](https://docs.astral.sh/ruff/)            | Lint and format (its defaults: 88 columns, double quotes) |
| [Pyright](https://microsoft.github.io/pyright/) | Type checking, `strict` (the signer)                      |
| [pytest](https://docs.pytest.org/)              | Tests                                                     |
| FastAPI on Uvicorn                              | HTTP                                                      |
| `prometheus-client`                             | Metrics at `/metrics`, where the service has a TCP port   |

- Dependencies are in `pyproject.toml` with lower bounds and locked in
  `uv.lock`, which is committed. Never `pip install`.
- Runtime dependencies are `[project] dependencies`; tools are the `dev`
  dependency group. Pyright is the exception: it is an npm package, a
  `devDependency` in `package.json`, pinned exactly.
- Lint rules include Ruff's `E`, `F`, `I`, `B`, `UP`, `SIM`, `N`, `RUF`
  (the signer adds `ANN`; the classifier adds `T20`, refusing `print`).
  A `# noqa` names the rule and sits on the line it applies to.

### In Turbo, or beside it

- **The signer** has a `package.json` that wraps the tools, so Turbo
  runs it like any other package:

  | Script              | Runs                                              |
  | ------------------- | ------------------------------------------------- |
  | `build`             | `uv sync --locked`                                |
  | `lint`              | `ruff check`, `ruff format --check`               |
  | `typecheck`         | `pyright`                                         |
  | `test`              | `pytest`                                          |
  | `openapi`           | writes `openapi/<name>.json`                      |
  | `check:conventions` | `check:openapi` and `lint:openapi`, as in the API |
  | `dev`, `start`      | the service with `dev.env`                        |

  Every `uv run` passes `--locked`, so a stale lock fails rather than
  being rewritten.

- **The classifier** is outside pnpm's workspace and Turborepo's graph,
  and Prettier and ESLint do not read it. `uv run ruff check .`,
  `uv run ruff format --check .` and `uv run pytest` are its checks; run
  them before calling work done, as the Turbo tasks are for the rest.

## Layout

```
pyproject.toml, uv.lock, dev.env.example
package.json, .python-version   the signer: Turbo's scripts, uv's Python
Dockerfile                      the classifier: its own image, this directory the context
src/<package>/                  the package (src layout; installed, not on sys.path)
  __init__.py                   what the service is, in its docstring
  __main__.py                   validates config, sets up logging, runs Uvicorn
  config.py                     read_config(): every environment variable, here only
  app.py                        create_app(config): routers, error handlers, /health
  errors.py                     the exceptions, each with its status and code
  models.py                     the wire shapes (Pydantic), and their conversion
  <subject>.py                  the domain, free of HTTP (vault.py, signing.py, ...)
  api/<feature>.py, <feature>/  a router or a package per feature
openapi/<name>.json             the signer's API document, generated and committed
test/ (signer), tests/ (classifier)
  mirrors src/<package>/ (test_<file>.py); the signer adds api/ for TestClient
```

- Modules and functions are `snake_case`, classes `PascalCase`,
  constants `UPPER_SNAKE`. File names are the module's subject, not a
  class name; one feature per module or package.
- Code under `src/`, tests under `test/` or `tests/`, never mixed. Test
  files are `test_<subject>.py`; test names say what is true
  (`test_lists_every_problem_together`).
- Work that runs on a schedule rather than per request is a command
  (`[project.scripts]`, `argparse`) in the same image, started by
  Airflow with the service's volume, not a route: the service only reads
  what it writes. Its output goes to `sys.stdout.write` or the log.

## Configuration

- `config.py` reads every variable in `read_config(env)` into a frozen
  dataclass, collects every problem and raises one `ConfigError` listing
  them all, as `@ncfritz/olympus-nest`'s `EnvReader` does. `__main__`
  reads it before anything starts. `os.environ` is read nowhere else,
  except by the app factory when Uvicorn builds the app itself
  (`serve --reload`).
- Names are UPPER_SNAKE with the service's prefix (`SIGNER_SOCKET_PATH`).
  Every variable is in `dev.env.example`.
- Secrets arrive as files (Compose secrets, ADR 0019), named by a
  `*_FILE` variable and read in `config.py`. No secret in source, logs or
  the image.

## The API

- FastAPI. Operations follow [api.md](api.md) where it applies: URI
  version `1`, PascalCase operation ids (the route function's
  `snake_case` name, converted by `create_app`), a summary and
  description on each, one tag, documented status codes. The signer's
  committed document is checked by `check:openapi` and linted with the
  API's Spectral rules.
- Request and response bodies are Pydantic models, never `dict`. Wire
  shapes are camelCase (`alias_generator=to_camel`), like the rest of
  Olympus, and forbid unknown fields.
- `/health` is unversioned and left out of the document
  (`include_in_schema=False`); it checks no dependency.
- A validation error says where and why, never what: FastAPI's default
  answer repeats the refused input, which could be a message's text or a
  key.

## Transport

- **The signer** serves on a Unix socket only; there is no TCP listener
  in any configuration, and nothing serves the document or the docs UI.
  The service calls it through a client generated from the committed
  document, internal to the service.
- **The classifier** reaches the platform only through the Olympus API,
  over HTTPS with its client certificate (ADR 0018, 0023), never Hasura
  or Postgres for platform data. Requests into it arrive on a **services
  listener** of its own: mutual TLS against the services chain and its
  revocation lists, and, since the handshake does not say which service
  it is, the client certificate's issuer and common name checked as the
  connection opens (`tls.py`; Uvicorn does not hand the certificate to
  the app). Every route that takes text is on it and nowhere else; the
  plain listener serves `/health` and `/metrics` only.

## Types and errors

- The signer runs Pyright `strict` over `src`, and its standard mode
  over `test` (fixtures and response bodies are not annotated line by
  line): every public function in `src` is annotated; `Any` and
  `# type: ignore` need a comment saying why.
- Immutable data is a frozen `dataclass`; wire shapes are Pydantic.
- Raise specific exceptions and turn them into HTTP errors at the edge:
  each is a subclass of the service's base error (the signer's
  `SignerError`) named `<What>Error` (Ruff's `N818`) carrying its status
  and a stable code, and `create_app` answers with an `ErrorResponse`.
  Pydantic's own validation errors answer `400` in the same shape. A
  signer refusal (`RefusedError`, `422`) names its invariant, never what
  a key is.

## Logging

- The standard `logging` module: `logger = logging.getLogger(__name__)`
  per module, configured once in `__main__`. No `print` outside a
  command line's own output.
- Never log key material, a passphrase, the unseal key or a token; never
  message text, a snippet, or anything derived from a body that could be
  read back (ADR 0030). Log IDs and counts.

## Data

- Private working state goes in the service's own store on its volume
  (for the classifier, SQLite databases: the features, and the model
  runs with their evaluation, a row per label rather than a JSON
  document, ADR 0007). It is derived data, rebuilt from its sources, and
  not backed up. The signer's keys are the exception: sealed, on their
  own volume, and backed up with the CA (ADR 0020).
- Message text exists only in memory, for the length of a request. It is
  not written to the store, a temporary file, a log or an exception
  message.

## Testing

- pytest. Routes through FastAPI's `TestClient`; calls to the API through
  `httpx.MockTransport`. Warnings are errors in review:
  `uv run pytest -W error` should pass.
- The signer's transport tests serve it on a real Unix socket (paths
  under `/tmp`: an `AF_UNIX` path is at most 104 bytes on macOS), and
  everything it produces is parsed back and verified, against its issuer
  with `cryptography` and with `openssl`. Every invariant has a test that
  it refuses.
- Unit tests for configuration and every feature; fixtures are small and
  synthetic, never real mail or real keys.

## Images

- Multi-stage: `uv sync --frozen --no-dev` into a virtualenv, copied into
  a slim runtime that runs as a non-root user, with a `HEALTHCHECK`.
  The signer is built from the shared `infra/docker/python/Dockerfile`
  with the repository as context; the classifier from its own
  `Dockerfile`, with its directory as context.
- A target in `/docker-bake.hcl`, built centrally with the others (ADR
  0011).
