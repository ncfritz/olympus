# 0030. Email management: a local label audit and suggestion engine over Gmail

- **Status:** Proposed
- **Date:** 2026-10-05

## Context

Neil's mail is one Google Workspace account (not consumer Gmail), more
than ten years old and a complete archive of everything received: about
11 GB, most of it attachments. It is largely organized with labels, but
tagging practice has drifted over the years:

- Some messages carry the wrong label, or none.
- Some labels exist under more than one root (`Accounts/Advertisements`
  and `Advertisements`).
- Some labels hold so much mail that they need sub-labels.
- Stars are applied inconsistently.
- Some labels are steps in a workflow rather than topics: a bill is
  labelled `Payable` when it arrives and relabelled `Paid` by hand later.

What is wanted, from the discussion of 2026-10-02:

1. **An audit, once and then on demand.** Find mislabelled messages,
   propose new labels and sub-labels, consolidate duplicate roots, and
   make starring consistent. Changes are applied in bulk, after review.
2. **Label suggestions for new mail**, learned from the existing labels
   as the training set. Suggestions are accepted or amended, never applied
   unseen, and each decision trains the model (online learning and a
   feedback loop). Gmail filters keep doing what they already do.
3. **A local review UX in Olympus**: the inbox with current and suggested
   labels, which messages have been reviewed, amending the labels, and
   writing the result to Gmail on approval. Also archive and mark as read.
4. **Statistics**: top senders and labels, sender and label activity over
   time, and a cluster view of labels.

Constraints Neil set:

- **No cloud LLMs.** Classical models first; an LLM only if it runs
  locally (Ollama).
- **Message text may be read for training and classification but is not
  stored.** Metadata may be stored. Subject lines count as metadata.
- It is a personal tool on the LAN. Absolute security is not required:
  features derived from the text (embeddings, hashed word counts) may be
  stored even though they are not perfectly irreversible.
- Olympus's own rules apply: the API is the only Hasura client, tables
  and columns rather than JSON (ADR 0007), audit columns on every table,
  secrets as files (ADR 0019), images built centrally (ADR 0011).

## Decision

### Gmail is the corpus; Olympus keeps metadata and derived features

- Olympus stores, per message: Gmail's message, thread and history IDs;
  date and size; from, reply-to, to and cc addresses, and which of
  Neil's addresses received it; `List-Id` and a few structural headers
  (the presence of `List-Unsubscribe`, the sending service); Gmail's
  category; unread, starred and in-inbox; the subject; attachment count,
  types and sizes; the labels. Subject lines take about 20 MB across
  250,000 messages.
- Message bodies are never written to disk by any Olympus component:
  not to a table, a queue, a log or a temporary file. The bodies are
  fetched, featurized in memory and dropped. Changing the features or
  the embedding model therefore means fetching the text again, a
  resumable job of a few hours.
- Opening a message in the site fetches it live from Gmail, through the
  API, and keeps it in the browser only.
- Attachments are never downloaded; their metadata comes with the
  message.

### Access: the Gmail API, through an Internal OAuth client

- The Gmail API, not IMAP. A Workspace consent screen set to
  **Internal** needs no Google verification for restricted scopes, and
  its refresh tokens do not expire after 7 days the way an External app's
  in testing do. The Google Cloud project is only an OAuth client; no
  data goes to it.
- Scopes: `gmail.readonly` until the first phase that writes, then
  `gmail.modify`. Label changes use `messages.batchModify` (1,000 IDs a
  call) and `messages.modify`; nothing is ever deleted.
- The account is linked to its Olympus user the way calendar accounts
  are ([ADR 0028](0028-minerva-calendar-ownership.md)): by consent from
  the site, in a flow the API starts and checks the `state` of, keyed by
  `(provider, subject)`. The agent keeps the refresh token; the API
  never sees it.
- Backfill: `messages.list`, then `messages.get` throttled under the
  per-user quota (about 250 units a second; a get is 5), resumable from a
  stored page token. Incremental sync polls `users.history.list` from the
  last `historyId`; push (`watch`) is not used because it needs Cloud
  Pub/Sub.

### Where it runs

| Component         | What it does                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents/mail`     | NestJS. Holds the Gmail credential. Backfill, history polling, label writes. Publishes message metadata to `mail.messages`; sends text to the classifier in memory.                                   |
| `apps/api`        | Consumes `mail.messages` into Hasura (as it consumes `calendar.events`). Owns suggestions, reviews, the change log and every operation the site uses; asks the agent to write to Gmail.               |
| `agents/mail-ml`  | Python (FastAPI). Featurizes text, keeps the feature store, trains, suggests, learns from decisions, runs the audit analyses. Calls the API for metadata and to post suggestions; never reads Hasura. |
| `apps/site`       | The Mail section and the home page's Mail widget.                                                                                                                                                     |
| Airflow           | The nightly retrain and audit runs (`infra/airflow/dags`).                                                                                                                                            |
| Ollama (optional) | Local embeddings (`nomic-embed-text`) and, later, a local LLM for naming clusters and cold-start labels.                                                                                              |

Queue messages carry IDs and metadata, never text. The agent sends a
message's text to `agents/mail-ml` in the body of an HTTPS request on
the internal network (service certificates, ADR 0018 and 0023), and the
classifier answers with nothing it stores outside its own feature store.

**Python is new to the workspace.** scikit-learn, River, cleanlab and
HDBSCAN have no TypeScript equivalents worth using, so the classifier is
Python. It sits outside pnpm and Turborepo, like `infra/airflow`, with
its own `pyproject.toml`, ruff and pytest, a Dockerfile built on the Mac
Mini with the rest, and a conventions page of its own. It is the only
Python service; the rest of mail stays TypeScript.

### The classifier

Layers, combined into a calibrated score per label, with a threshold per
label:

1. **Sender history**: the labels earlier mail from the same address,
   `List-Id` or domain received, weighted toward recent mail. It updates
   the moment a decision is made.
2. **A linear model**: hashed word counts of subject and body plus the
   header features, one-vs-rest logistic regression, updated online
   (`partial_fit` or River) and retrained nightly.
3. **Embeddings and nearest neighbours**: a small local embedding model;
   catches new senders whose mail resembles known mail.
4. **A local LLM** (later, optional): naming clusters, labels with few
   examples.

Evaluation splits by time (train on older mail, test on recent months),
since a random split hides drift. Old examples decay, and corrections
weigh more than plain acceptances.

### Label kinds

Every label has a kind, stored in Olympus:

- **Topical** (`Finance/Utilities`): predicted by the classifier.
- **State** (`Bills/Payable`, `Bills/Paid`): members of a **family** with
  an initial state and allowed transitions. The classifier predicts the
  family ("this is a bill"); the initial state is applied. For training
  a state label counts as its family, so history full of `Paid` does not
  teach the model to suggest `Paid` for new bills. Moving a message to
  the next state is a suggestion too (a payment confirmation from a biller
  with an open `Payable`).
- **System** (`INBOX`, `UNREAD`, `STARRED`, `IMPORTANT`, categories): not
  trained on; read and written as flags.
- **Retired**: a label being merged; picking it applies its target.

### Changes are reviewed, logged and undoable

Nothing reaches Gmail without a decision in the site: one message, a
selection, or a bulk action over a label with its confidence filter.
Before a write, the API records each message's labels as they were in a
change log, and checks the message's `historyId`: a message changed in
Gmail since the suggestion is synced again first, so a manual change is
never overwritten. Any batch can be undone from the log.

## Open questions

To settle before this record is accepted:

1. **Domain.** Proposed: Minerva (`minerva` schema, the `/minerva`
   document), beside the calendar accounts it shares Google accounts
   with. The site design places Mail as its own entry in the main menu;
   the other choice is a Mail entry inside Minerva's menu. A domain of its
   own (named after a god, as the others are) is the third option.
2. **The OAuth client.** The calendar agent's Google client with Gmail
   scopes added by incremental consent, or a client of its own in the same
   project.
3. **Where the features live.** The platform's Postgres is stock
   `postgres:16.3`, without pgvector. Options: a pgvector image for a
   separate classifier database in the data stack; or a store inside
   `agents/mail-ml` (SQLite and an in-memory index: 250,000 vectors of
   384 int8 values is under 100 MB).
4. **Gmail's snippet.** Storing the 200-character preview (about 50 MB)
   lets lists render without a live fetch, but it is body text.
5. **Stars.** What a star means (needs action, or important) decides
   whether stars become a state family. As far as we know the API exposes
   only `STARRED`, not which of Gmail's star icons is used; phase 1
   checks.

## Consequences

- The audit and the recommender share one sync and one store: the
  classifier's disagreements with existing labels are the audit's best
  signal, and the cleaned labels are the classifier's better training
  set.
- A second runtime enters the repository, with its own toolchain, image
  and conventions, and nothing in the workspace checks it.
- Olympus holds about a gigabyte for mail (metadata, subjects, features)
  instead of 11 GB.
- Re-featurizing needs Gmail and a few hours; it is a background job,
  with old and new feature versions side by side until it finishes.
- Gmail writes need `gmail.modify`, a broader grant than the calendar's
  read-only scope; the review step and the change log are what make that
  acceptable.
