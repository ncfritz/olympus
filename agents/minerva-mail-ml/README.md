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

It has two listeners, and a training command. The plain one serves `/health` and `/metrics`. The
services one, mutual TLS, is the only way text arrives: a client
certificate from the services issuer, and only the services in
`SERVICES_ALLOWED_CLIENTS` (the mail agent), checked as each connection
opens.

| Route                        | What                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| `POST /v1/features`          | A batch of up to 500 messages' text, featurized and stored      |
| `POST /v1/features/complete` | Marks a feature version built: it serves from then on           |
| `GET /v1/features/versions`  | The versions in the store, their messages, and which one serves |
| `POST /v1/suggestions`       | Up to 500 messages' text in, each one's suggested labels out    |

The feature store is SQLite (`FEATURE_STORE_PATH`): per feature version,
each message's hashed token counts (subject, the body's first 5,000
characters, sender, list, attachments) and the sender and list beside
them. No text. A new version builds beside the old, which serves until the
new one is complete.

## Training

`minerva-mail-ml-train run` trains every mail account (or `--account ID`)
on the serving feature version, with the metadata and labels it reads from
the API (`GET /v1/minerva/mail/training/...`, agents only, so the API needs
`minerva-mail-ml:agent` in `AUTH_SERVICE_ROLES`). Nightly, Airflow runs it
in this image ([minerva_mail_retrain](../../infra/airflow/dags/minerva_mail_retrain.py)).

- **Targets.** A topical label is a topic; a state label counts as its
  family, and a predicted family suggests the family's initial label
  (`Bills/*Payable`, never `Bills/*Paid`); a retired label counts as what
  it merges into; system labels and stars never. Sent mail is left out.
- **Layers.** Sender history (address, else list, else domain; decayed
  with a one-year half-life) and one-vs-rest logistic regression over the
  hashed counts (SGD; older mail weighs less), combined per label by a
  small logistic regression: the calibration.
- **Split by time.** The last six months are the test set, the six before
  them validation, everything older training. The layers learn from
  training; the combiner and each label's threshold (the highest score
  that still finds what it can at 90% precision) from validation; the
  test months are then scored and written to the run, per label, at its
  threshold and at 0.5, the baseline. The serving model is refitted on
  everything.
- **Runs.** `MODEL_DIR/runs.sqlite3` records every run and its evaluation;
  the newest ready run of an account serves, picked up on the next
  request. A failed run leaves the last one serving. Model files of all
  but the newest three ready runs are removed.

`minerva-mail-ml-train report` prints each account's newest run (or
`--run ID`): its split, the overall precision and recall, and each
label's.

## Working on it

```sh
cd agents/minerva-mail-ml
uv sync --group dev              # .venv from uv.lock
uv run ruff check . && uv run ruff format --check .
uv run pytest
cp dev.env.example dev.env
uv run --env-file dev.env minerva-mail-ml
uv run --env-file dev.env minerva-mail-ml-train run      # with the API up
uv run --env-file dev.env minerva-mail-ml-train report
```

## The image

```sh
docker buildx bake --load minerva-mail-ml    # from the repository root
```

## Configuration

| Variable                   | What                                                    | Default                 |
| -------------------------- | ------------------------------------------------------- | ----------------------- |
| `LISTEN_PORT`              | `/health`, `/metrics`                                   | `3106`                  |
| `SERVICES_LISTEN_PORT`     | The services listener                                   | `3107`                  |
| `TLS_CERT`, `TLS_KEY`      | Its certificate (all four TLS settings, or none)        | (no services listener)  |
| `TLS_CA_SERVICES`          | The services chain it trusts                            |                         |
| `SERVICES_ISSUER`          | The issuing CA's common name a client must come from    |                         |
| `TLS_CRL_SERVICES`         | Revocation lists, comma-separated: one per authority    | (none)                  |
| `SERVICES_ALLOWED_CLIENTS` | Services let in, by certificate common name             | `minerva-mail-agent`    |
| `FEATURE_STORE_PATH`       | The feature store                                       | `data/features.sqlite3` |
| `MODEL_DIR`                | Model runs and their models                             | `data/models`           |
| `API_BASE_URL`             | The API's mTLS listener, for training                   | (no training)           |
| `API_CLIENT_CERT`, `_KEY`  | The classifier's client certificate (all four, or none) |                         |
| `API_CA_CERT`              | The services chain the API's certificate is from        |                         |
| `LOG_LEVEL`                | `debug`, `info`, `warning`, `error`                     | `info`                  |
| `ENVIRONMENT`              | Labels the logs                                         | `development`           |
| `APP_NAME`                 | The service's name                                      | `minerva-mail-ml`       |
