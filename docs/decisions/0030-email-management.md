# 0030. Email management: a local label audit and suggestion engine over Gmail

- **Status:** Accepted
- **Date:** 2026-10-05 (accepted 2026-10-05)

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
- Gmail's snippet (the first 200 or so characters, about 50 MB in all)
  is stored too, so lists render without a live fetch (Neil,
  2026-10-05). It is the one piece of body text kept, and can be dropped
  later without changing anything else.
- Beyond the snippet, message bodies are never written to disk by any
  Olympus component: not to a table, a queue, a log or a temporary file.
  The bodies are fetched, featurized in memory and dropped. Changing the features or
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
- **A client of its own** (Neil, 2026-10-05), in the same project as the
  calendar agent's but separate from it, so mail's broader scopes never
  touch the calendar's consent or credentials.
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

### A Takeout archive spares the Gmail API

**Amended (Neil, 2026-10-05).** Until the system is accepted, testing
reads a Google Takeout export of the mailbox instead of the Gmail API, so
the backfill, the audit, the classifier and every re-run of them cost no
API quota. The API is used only to link the account, reconcile, follow
new mail and write.

- **What Takeout gives.** One mbox of all mail. As far as we know each
  message's `From ` line carries its Gmail message ID in decimal
  (`X-GM-MSGID`), whose hexadecimal form is the API's message ID; the
  `X-GM-THRID` header is the thread ID the same way; and
  `X-Gmail-Labels` lists the labels by name, system labels included
  (Inbox, Unread, Starred, Important, the categories, Spam, Trash). Phase
  1 confirms all of this on the real archive before anything is built
  on it.
- **What it lacks.** No `historyId`, no label IDs (names only), no star
  icon (only Starred), no Gmail snippet. The importer makes a snippet of
  its own from the plain text (the first 200 characters, whitespace
  collapsed); a message that later arrives through the API carries
  Gmail's.
- **How it is read.** In place, read-only, streamed: the archive stays
  where Neil keeps it and is never copied into Olympus. Each message goes
  through the same path as a fetched one: metadata to `mail.messages`,
  text to the classifier in memory. Attachment parts are measured, not
  decoded. Spam and Trash are skipped. Importing again, or a newer
  archive, updates by message ID.
- **Who runs it.** An operator command in `agents/mail`, run from the
  workspace against an environment, not a route a user can reach. The
  account it fills is recorded with verification method `import` and
  has no subject until it is linked by consent, which must return the
  same address.
- **Switching to the API** (once, when the account is linked):
  `getProfile` for the `historyId` polling starts from; `labels.list` to
  match label names to IDs; then the labels as they are now, by listing
  each label's message IDs (and All Mail's, to find what was deleted)
  rather than fetching messages; then `messages.get` only for mail newer
  than the archive. About a thousand list calls against the roughly
  250,000 gets a full backfill takes.
- **Re-featurizing** (a new feature version or embedding model) reads the
  archive again rather than Gmail while one is at hand.
- A Workspace account can export with Takeout only when the domain's
  admin allows it for the user.

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

### Minerva

Mail is part of Minerva (Neil, 2026-10-05): the `minerva` schema, the
`/minerva` OpenAPI document, `apps/api/src/minerva/mail`, beside the
calendar accounts it shares Google accounts with. In the site it is a
Mail sub-menu in Minerva's menu (Neil, 2026-10-05).

### The classifier

**Its features live with it** (Neil, 2026-10-05): a store inside
`agents/mail-ml`, a SQLite database on the service's volume, with the
embeddings loaded into memory for the neighbour search (250,000 vectors
of 384 int8 values is under 100 MB). The platform's Postgres stays as it
is (stock `postgres:16.3`, no pgvector). The store is derived data,
rebuilt from Gmail and the labels, so it is not backed up, as the
weather tables are not.

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

### Stars are a state

Neil uses Gmail's superstars to say a message **needs attention**, or
that the thing it asked for **is done** (a bill paid) (2026-10-05). So
stars are treated as a state family alongside the labels, not as a
topic:

- Each star icon in use is mapped to a meaning: attention or done.
  Phase 1 counts the messages per icon to show which are in use.
- A state family's open states call for the attention star and its
  closed states for the done star: a `Bills/Payable` message should carry
  the attention star, a `Bills/Paid` one the done star. The audit lists
  messages that disagree, and a transition suggests both changes
  together.
- Starred messages are never trained on as a topic.

As far as we know, the Gmail API's labels show only `STARRED`, but its
search accepts the star operators (`has:red-bang`, `has:green-check`,
and so on), so Olympus can read which star a message has, one query per
icon. Setting a particular star may not be possible: `STARRED` applies
the first star in Gmail's list. Phase 1 confirms both. If only `STARRED`
can be written, Olympus suggests the star change and Neil sets the icon
in Gmail, and the next sync picks it up.

### Changes are reviewed, logged and undoable

Nothing reaches Gmail without a decision in the site: one message, a
selection, or a bulk action over a label with its confidence filter.
Before a write, the API records each message's labels as they were in a
change log, and checks the message's `historyId`: a message changed in
Gmail since the suggestion is synced again first, so a manual change is
never overwritten. Any batch can be undone from the log.

## Settled

Neil answered the open questions on 2026-10-05: Minerva is the domain;
mail has an OAuth client of its own; the features live with the
classifier; the snippet is stored; stars are attention and done states.
In the site, Mail is a sub-menu of Minerva's menu, as Reviews and
Meetings are.

## Consequences

- The audit and the recommender share one sync and one store: the
  classifier's disagreements with existing labels are the audit's best
  signal, and the cleaned labels are the classifier's better training
  set.
- A second runtime enters the repository, with its own toolchain, image
  and conventions, and nothing in the workspace checks it.
- Olympus holds a few hundred megabytes for mail (metadata, subjects,
  snippets), and the classifier about as much again for features,
  instead of 11 GB.
- Re-featurizing needs Gmail and a few hours; it is a background job,
  with old and new feature versions side by side until it finishes.
- Gmail writes need `gmail.modify`, a broader grant than the calendar's
  read-only scope; the review step and the change log are what make that
  acceptable.
