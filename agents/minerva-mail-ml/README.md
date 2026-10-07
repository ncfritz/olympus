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

| Route                          | What                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `POST /v1/features`            | A batch of up to 500 messages' text, featurized and stored      |
| `POST /v1/features/complete`   | Marks a feature version built: it serves from then on           |
| `GET /v1/features/versions`    | The versions in the store, their messages, and which one serves |
| `POST /v1/suggestions`         | Up to 500 messages' text in, each one's suggested labels out    |
| `POST /v1/embeddings`          | A batch's text embedded by Ollama and stored (the archive pass) |
| `POST /v1/embeddings/complete` | Marks an embedding version built: training uses it from then on |
| `GET /v1/embeddings/versions`  | The embedding versions, their messages, and which one serves    |

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
  training; the combiner and each label's threshold from validation (0.5,
  raised only for a label below 90% precision there, to the lowest score
  that reaches it); the
  test months are then scored and written to the run, per label, at its
  threshold and at 0.5, the baseline, with the mean over labels beside the
  overall figures, which the busiest label otherwise dominates. The serving model is refitted on
  everything.
- **Runs.** `MODEL_DIR/runs.sqlite3` records every run and its evaluation;
  the newest ready run of an account serves, picked up on the next
  request. A failed run leaves the last one serving. Model files of all
  but the newest three ready runs are removed.

`minerva-mail-ml-train suggest` (or `--account ID`) looks over the whole
mailbox for labels that are wrong (docs/plans/email-management phase 4):
every message is scored by layers fitted on the other four fifths of the
mail (folds by Gmail ID) and combined by the serving model's combiner, and
then, label by label, confident learning (`cleanlab`) finds where a
message's label disagrees with what the rest of the mailbox says. Each
disagreement is a suggestion to add or remove that label; a family is only
ever added, as its initial state. Additions are ticked at the label's
threshold, removals only from 0.9. The suggestions are posted to the API as
a run (`CreateMailSuggestionRun`, `CreateMailSuggestions`,
`PublishMailSuggestionRun`), which shows them on the Re-classification
page beside the audit's. It needs a serving model trained on the labels as
they are now; if they have changed since, train first.

`minerva-mail-ml-train report` prints each account's newest run (or
`--run ID`): its split, the overall and per-label-mean precision and
recall, and each label with test mail (`--all` for every label).

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

| Variable                   | What                                                     | Default                 |
| -------------------------- | -------------------------------------------------------- | ----------------------- |
| `LISTEN_PORT`              | `/health`, `/metrics`                                    | `3106`                  |
| `SERVICES_LISTEN_PORT`     | The services listener                                    | `3107`                  |
| `TLS_CERT`, `TLS_KEY`      | Its certificate (all four TLS settings, or none)         | (no services listener)  |
| `TLS_CA_SERVICES`          | The services chain it trusts                             |                         |
| `SERVICES_ISSUER`          | The issuing CA's common name a client must come from     |                         |
| `TLS_CRL_SERVICES`         | Revocation lists, comma-separated: one per authority     | (none)                  |
| `SERVICES_ALLOWED_CLIENTS` | Services let in, by certificate common name              | `minerva-mail-agent`    |
| `FEATURE_STORE_PATH`       | The feature store                                        | `data/features.sqlite3` |
| `MODEL_DIR`                | Model runs and their models                              | `data/models`           |
| `API_BASE_URL`             | The API's mTLS listener, for training                    | (no training)           |
| `API_CLIENT_CERT`, `_KEY`  | The classifier's client certificate (all four, or none)  |                         |
| `API_CA_CERT`              | The services chain the API's certificate is from         |                         |
| `LEARN_SECONDS`            | How often to learn from approvals in the inbox; 0: never | `60`                    |
| `OLLAMA_URL`               | Ollama, for embeddings and the neighbours layer          | (no embeddings)         |
| `EMBED_MODEL`              | The Ollama model that embeds                             | `nomic-embed-text`      |
| `LOG_LEVEL`                | `debug`, `info`, `warning`, `error`                      | `info`                  |
| `ENVIRONMENT`              | Labels the logs                                          | `development`           |
| `APP_NAME`                 | The service's name                                       | `minerva-mail-ml`       |
