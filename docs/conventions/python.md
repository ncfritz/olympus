# Python conventions (`apps/harpocrates/signer`)

TypeScript is the rule; Harpocrates's signer is the one exception
([ADR 0020](../decisions/0020-internal-certificate-authority.md)), because
Python's `cryptography` is ahead for the revocation lists, PKCS#12 and
OCSP the CA depends on. It is kept small enough to read in a sitting: it
holds the keys and signs, and decides nothing the service can decide.
These rules are for it, and for any Python that follows it.

## Toolchain

| Tool                                            | Does                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| [uv](https://docs.astral.sh/uv/)                | Python version, the environment, dependencies, `uv.lock`  |
| [Ruff](https://docs.astral.sh/ruff/)            | Lint and format (its defaults: 88 columns, double quotes) |
| [Pyright](https://microsoft.github.io/pyright/) | Type checking, `strict`                                   |
| [pytest](https://docs.pytest.org/)              | Tests                                                     |

- The Python version is in `.python-version` and `requires-python`; uv
  installs it. Dependencies are in `pyproject.toml` with lower bounds and
  locked in `uv.lock`, which is committed. Never `pip install`.
- Runtime dependencies are `[project] dependencies`; tools are the `dev`
  dependency group. Pyright is the exception: it is an npm package, a
  `devDependency` in `package.json`, pinned exactly.
- The project's `package.json` wraps them, so Turbo runs Python like any
  other package:

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

- Lint rules: Ruff's `E`, `F`, `I`, `B`, `UP`, `SIM`, `N`, `ANN`, `RUF`.
  A `# noqa` names the rule and sits on the line it applies to.

## Layout

```
pyproject.toml, uv.lock, .python-version, package.json, dev.env.example
src/<module>/                the package (src layout; installed, not on sys.path)
  __init__.py                what the service is, in its docstring
  __main__.py                the command line: serve, health, openapi, ...
  config.py                  read_config(env) -> Config
  app.py                     create_app(): the FastAPI application
  transport.py               serving, and the client side of the socket
  <feature>.py               a router per feature (health.py, ...)
openapi/<name>.json          the API document, generated and committed
test/
  unit/                      mirrors src/<module>/ (test_<file>.py)
  api/                       the application through TestClient
```

- Modules and functions are `snake_case`, classes `PascalCase`,
  constants `UPPER_SNAKE`. File names are the module's subject, not a
  class name.
- Tests live under `test/`, never in `src/`. Test files are
  `test_<subject>.py`; test names say what is true
  (`test_lists_every_problem_together`).

## Configuration

- `config.py` reads every variable in `read_config(env)`, collects every
  problem and raises one `ConfigError` listing them all, as
  `@ncfritz/olympus-nest`'s `EnvReader` does. `__main__` reads it before
  anything starts. `os.environ` is read nowhere else.
- Names are UPPER_SNAKE with the service's prefix (`SIGNER_SOCKET_PATH`).
  Every variable is in `dev.env.example`.
- Secrets arrive as files (Compose secrets, ADR 0019), named by a
  `*_FILE` variable. Never log one.

## The API

- FastAPI. Operations follow [api.md](api.md) where it applies: URI
  version `1`, PascalCase operation ids (the route function's
  `snake_case` name, converted by `create_app`), a summary and
  description on each, one tag, documented status codes. The committed
  document is checked by `check:openapi` and linted with the API's
  Spectral rules.
- Request and response bodies are Pydantic models, never `dict`.
- `/health` is unversioned and left out of the document
  (`include_in_schema=False`); it checks no dependency.
- The signer serves on a Unix socket only; there is no TCP listener in
  any configuration, and nothing serves the document or the docs UI.
- The service calls it through a client generated from the committed
  document, internal to the service.

## Types and errors

- Pyright `strict` over `src` and `test`: every public function is
  annotated; `Any` and `# type: ignore` need a comment saying why.
- Immutable data is a frozen `dataclass`; wire shapes are Pydantic.
- Raise specific exceptions and turn them into HTTP errors at the edge.
  A signer refusal says which invariant, never what a key is.

## Logging

- The standard `logging` module: `logger = logging.getLogger(__name__)`
  per module, configured once in `__main__`. No `print` outside the
  command line's own output.
- Never log key material, a passphrase, the unseal key or the token,
  or a request body that may carry one.

## Testing

- pytest, from `test/`. `api/` drives the application through
  `TestClient`; transport tests serve it on a real Unix socket (paths
  under `/tmp`: an `AF_UNIX` path is at most 104 bytes on macOS).
- Everything the signer produces is parsed back and verified (from
  phase 1: against its issuer with `cryptography` and with `openssl`).
- Every invariant has a test that it refuses.
