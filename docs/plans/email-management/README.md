# Email management: phased implementation plan

The implementation of
[ADR 0030](../../decisions/0030-email-management.md) and the
[design](design.md). Each phase ends in a working, deployable state and
a functional sign-off against [signoff.md](signoff.md). Work happens on
the `feature/email-management` branch.

Nothing here writes to Gmail before phase 4, and nothing writes without a
decision in the site.

| Phase | Delivers                                                                                        | Depends on | Sign-off flows |
| ----- | ----------------------------------------------------------------------------------------------- | ---------- | -------------- |
| 0     | ADR accepted; empty feature in the model, API and site; the two agents' skeletons               | —          | —              |
| 1a    | A Takeout archive imported: labels and message metadata, no Gmail API calls                     | 0          | M0             |
| 1b    | The account linked; reconciled with Gmail; history polling; star icons                          | 1a         | M1, M2         |
| 2     | The audit on metadata (read-only reports); the Statistics page                                  | 1a         | M3, M4         |
| 3     | The classifier: features, sender history and linear model, offline evaluation; label kinds      | 1a         | M5             |
| 4     | Re-classification: suggestions over the mailbox; review and bulk apply to Gmail; merges, splits | 1b, 2, 3   | M6–M8          |
| 5     | The Mail inbox, the home page widget, the label picker; online learning from every decision     | 3, 4       | M9, M10        |
| 6     | Embeddings, the Clusters page, new-label suggestions                                            | 3          | M11            |
| 7     | Workflow transitions (Payable → Paid), stars, Gmail filter proposals                            | 5          | M12            |
| Later | A local LLM for cluster names and cold-start labels; iOS; other mail accounts                   |            |                |

Phases 2 and 3 need only the archive (1a), and are independent of each
other; the Gmail API is first needed in 1b, and for writes in 4. Phase 6
can start any time after 3.

## Settled 2026-10-05

ADR 0030's open questions, as Neil answered them:

1. **Minerva** is the domain; the paths below follow it.
2. Mail has **an OAuth client of its own**, in the calendar agent's
   Google project.
3. The features live **with the classifier**, in its own store.
4. Gmail's **snippet is stored**, and can be dropped later.
5. **Stars** mark a message needing attention, or its action done: a
   state alongside the labels.

In the site, Mail is a sub-menu of Minerva's menu, after Meetings, as
Reviews and Meetings are.

## Where the code goes

| What           | Where                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model shapes   | `packages/model/src/minerva/mail/`: accounts, labels, messages, suggestions, reviews, changes, audit, stats                                                                         |
| Messages       | `packages/messages/src/mail.ts`: `MailMessageMessage` (metadata only), routing constants                                                                                            |
| API            | `apps/api/src/minerva/mail/`: `MailModule`, `controllers/`, `services/`, `converters/`, `queries/`, `consumers/`                                                                    |
| Schema         | `infra/hasura/migrations/olympus/<ts>_minerva_mail_*`, with metadata                                                                                                                |
| Gmail agent    | `agents/minerva-mail/`: NestJS, `providers/gmail/`, `sync/`, `writes/`, `store/` (sync cursors only)                                                                                |
| Classifier     | `agents/minerva-mail-ml/`: Python, `pyproject.toml`, `src/minerva_mail_ml/` (`features/`, `store/`, `models/`, `audit/`, `api/`), `tests/`                                          |
| Feature store  | `agents/minerva-mail-ml`'s volume: a SQLite database, embeddings loaded into memory; not backed up (rebuilt from Gmail)                                                             |
| Scheduled runs | `infra/airflow/dags/mail_retrain.py`, `mail_audit.py`                                                                                                                               |
| Site           | `apps/site/src/pages/minerva/mail/`, `src/components/minerva/mail/`, `src/components/widgets/mail/`, `src/api/mailApi.ts`, `mail-container` in `components/minerva/layout/menu.tsx` |
| Conventions    | `docs/conventions/python.md` (new), linked from `CLAUDE.md`                                                                                                                         |

The API operations follow `docs/conventions/api.md` and start from
`pnpm gen api-operation`. Every operation is `@RequiresIdentity()` and
scoped to the caller's accounts. The agents follow
`docs/conventions/agent.md`; the classifier follows the new Python page.

## Schema

All tables in `minerva`, each with `created_at` and `updated_at`, their
trigger and the custom names `createdTime` and `lastUpdatedTime`, as every
table has. No JSON columns (ADR 0007): lists are rows.

| Table                      | Holds                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mail_accounts`            | `provider`, `subject` (unique together), `email`, `user_id`, verification method and time, sync state (backfill cursor, last `historyId`)                                                   |
| `mail_labels`              | Gmail's label ID and name, `parent_id` (from the `/` path), `kind` (topical, state, system, retired), `family_id`, `merge_into_id`, colour                                                  |
| `mail_label_families`      | A state family: name, initial label; per label, whether it is open (wants the attention star) or closed (the done star)                                                                     |
| `mail_label_transitions`   | Allowed moves in a family: from label, to label                                                                                                                                             |
| `mail_messages`            | Gmail IDs, `history_id`, date, size, sender address, name and domain, reply-to, receiving alias, `List-Id`, category, flags, subject, snippet, template hash, `star` (the icon, when known) |
| `mail_star_meanings`       | Per account: a star icon and what it means (attention, done)                                                                                                                                |
| `mail_message_recipients`  | To and cc addresses, one row each                                                                                                                                                           |
| `mail_message_attachments` | Type, extension and size, one row each                                                                                                                                                      |
| `mail_message_labels`      | The message's labels as Gmail has them now                                                                                                                                                  |
| `mail_suggestions`         | Message, label, add or remove, confidence, source (sender, linear, neighbours, audit), reason, model version, run                                                                           |
| `mail_reviews`             | Per message: pending, approved, amended, skipped, processed; who and when                                                                                                                   |
| `mail_change_batches`      | One write to Gmail: what started it, when applied, when undone                                                                                                                              |
| `mail_changes`             | Per message and label in a batch: add or remove, and whether the label was there before                                                                                                     |
| `mail_audit_runs`          | One audit: when, model version, counts                                                                                                                                                      |
| `mail_merge_candidates`    | From label, into label, sender overlap, messages moved, reason, dismissed                                                                                                                   |
| `mail_split_candidates`    | Label, proposed sub-label, message count                                                                                                                                                    |
| `mail_clusters`            | Run, cluster number, size, purity, a name, map coordinates of its sample points (a row per point)                                                                                           |

Statistics (top senders, activity by year) are SQL functions taking a
`user_id`, as Minerva's other statistics are.

## Configuration

Secrets arrive as `NAME_FILE` (ADR 0019). Each variable goes into the
service's `readConfig()` or `configuration.ts`, its `*.env.example`, its
README table and `infra/docker/env/<env>/`.

| Service           | Variable                      | Default                | What                                                            |
| ----------------- | ----------------------------- | ---------------------- | --------------------------------------------------------------- |
| `minerva-mail`    | `GOOGLE_CLIENT_ID`            | —                      | Mail's own OAuth client, not the calendar agent's               |
| `minerva-mail`    | `GOOGLE_CLIENT_SECRET`        | —                      | Secret `google_mail_client_secret`                              |
| `minerva-mail`    | `MAIL_QUOTA_UNITS_PER_SECOND` | `150`                  | Kept under Gmail's per-user limit                               |
| `minerva-mail`    | `MAIL_HISTORY_POLL_SECONDS`   | `60`                   | Incremental sync interval                                       |
| `minerva-mail`    | `MAIL_WRITES_ENABLED`         | `false`                | Until phase 4; without it, write requests answer 503            |
| `minerva-mail`    | `MAIL_ML_URL`                 | —                      | The classifier                                                  |
| `minerva-mail-ml` | `OLYMPUS_API_URL`             | —                      | Metadata and suggestions                                        |
| `minerva-mail-ml` | `MAIL_ML_STORE`               | `/data/mail-ml.sqlite` | The feature store, on the service's volume                      |
| `minerva-mail-ml` | `OLLAMA_URL`                  | —                      | Optional; without it, embeddings come from a bundled ONNX model |
| `api`             | `MAIL_SUGGEST_THRESHOLD`      | `0.7`                  | Default per-label threshold for showing a suggestion as ticked  |

## Phase 0 — Decision and scaffolding — done 2026-10-05

1. **ADR 0030 accepted**: **done** 2026-10-05.
2. **Model and API**: **done** — `minerva/mail/index.ts`; `MailModule` in
   `MINERVA_MODULES`, no operations.
3. **Agents**: **done** — `agents/minerva-mail` (`@ncfritz/minerva-mail-agent`)
   from the weather relay's layout: configuration, logging, `/metrics` on
   3105, no handlers; the broker and the API client come with 1a.
   `agents/minerva-mail-ml` with `pyproject.toml` and `uv.lock`, ruff,
   pytest, `/health` and `/metrics` on 3106. Both are bake targets in the
   services group. Neither joins a compose stack yet: the agent does in
   1b and the classifier in phase 3, when each first runs continuously
   (the 1a import runs from the workspace).
4. **Conventions**: **done** — `docs/conventions/python.md` and its line in
   `CLAUDE.md`.
5. **Site**: **done** — a Mail sub-menu in Minerva's menu (`mail-container`, after
   Meetings, with its path matchers) holding Inbox, Re-classification,
   Statistics and Clusters, each an empty page under
   `pages/minerva/mail/` behind sign-in.

**Sign-off:** both agents and the API boot; the menu opens the pages;
the Turbo tasks and the classifier's checks pass.

Checked 2026-10-05 on Node 26.9 and pnpm 10.34.5: build, lint,
typecheck, test and `check:conventions` pass for the model, the API, the
mail agent and the site, and `check:openapi` for the API, except the
site's typecheck, which fails on `main` too (`test/unit/triage.spec.ts`,
its vitest mock types); the site builds with the four Mail pages. The mail
agent boots and answers `/health` and `/metrics`. The classifier passes
`ruff check`, `ruff format --check` and `pytest -W error`. Not yet run:
the two images through `docker buildx bake`, and the API booted against a
database.

## Phase 1a — Import from Takeout

No Gmail API calls (ADR 0030, as amended 2026-10-05).

1. **The archive checked first**: on Neil's export, confirm the `From `
   line's ID and `X-GM-THRID` convert to the API's IDs (spot-checked
   against a few messages opened in Gmail), how `X-Gmail-Labels` names
   nested, system and category labels and quotes commas, and how Spam,
   Trash and chats appear. What is found goes into this plan before the
   reader is written.

   **Found 2026-10-05**, from one streamed pass over the export (12.06 GB,
   277,751 messages, 66 s on Neil's machine; only counts and header
   names read):
   - Every message starts `From <decimal id>@xxx <date>`; all 277,751 IDs
     are decimal, and no other line after a blank one starts `From `.
     There is no `X-GM-MSGID` header: the separator is the only source
     of the message ID. Converting to hexadecimal is to be spot-checked
     in Gmail (`#all/<hex>`).
   - `X-GM-THRID` is on every message, always decimal.
   - `X-Gmail-Labels` is on all but 1,315 messages, comma-separated, with
     nested labels by `/` path (`Accounts/Utilities/FrontPoint`). No
     label is quoted, so no label name has a comma. 499 distinct names.
   - Pseudo-labels Takeout adds, which are not Gmail labels: `Archived`
     (not in the inbox; 254,292) and `Opened` (read; 86,168). `Unread`
     (464) and `Inbox` (57) appear too, so in-inbox is `Inbox` present,
     and read is `Unread` absent.
   - System labels by display name: `Important`, `Starred` (3,723; no
     star icon), `Sent` (20,314), `Trash` (3), `Category Updates`,
     `Category Promotions`, `Category Personal`, `Category Social`,
     `Category Purchases`. No `Spam`.
   - `Chat` (2,390) marks old Hangouts chats: skipped, like Trash.
   - Sizes: median 23 KB, 99th percentile 223 KB, largest 29 MB.
   - `List-Id` is on 14,093 messages and `List-Unsubscribe` on 66,423, so
     `List-Unsubscribe` is the better newsletter signal.
   - One label holds 43 % of all mail: `Accounts/Utilities/FrontPoint`
     (118,475), worth its own look in the audit.
   - Still to learn: what the 1,315 messages without `X-Gmail-Labels`
     are, and whether drafts are in the export.

2. **Migration**: **done** 2026-10-05. `1791200000000_minerva_mail`:
   `mail_accounts` (`subject` nullable until linked; verification
   `import` or `consent`), `mail_labels` (Gmail's label ID nullable until
   linked; parent from the `/` path), `mail_messages` (unique by account
   and Gmail ID; `snapshot_time` orders writes; snippet at most 200
   characters) and its recipient, attachment and label tables, with
   `infra/hasura/tests/minerva_mail.sql`.
3. **Reader**: **done** 2026-10-05. `sources/takeout/` in
   `agents/minerva-mail`: `MboxReader` streams the archive message by
   message from a byte offset, splitting only on Takeout's separator;
   `TakeoutParser` (on `postal-mime`) yields the same `MailSourceMessage`
   a Gmail fetch will: IDs in hexadecimal, received and sent times,
   addresses (lower case), `List-Id`, `List-Unsubscribe`, subject, labels
   split into user labels, system flags and categories (Takeout's
   `Archived` and `Opened` dropped), attachment types and sizes (decoded in
   memory to be measured, then dropped), plain text (from HTML when there
   is no text part) and the snippet. `takeout scan` runs both over an
   archive and prints counts only.

   **Run over the whole export 2026-10-05**, on Neil's machine in three
   resumed slices (about six minutes, some 700 messages a second): all
   277,751 messages parsed, none failed, all IDs distinct. Text for all
   but 104. 8,605 messages carry 23,174 attachments. 6,118 have no user
   label (the 1,315 without a label header, and those with only system
   labels or categories). To skip: 2,390 chats and 3 in Trash. The
   slowest message took 0.76 s; the largest is 29 MB. Categories as Gmail
   names them: updates, promotions, personal, social, purchases, bills,
   travel, forums.

4. **Command**: **done** 2026-10-05, not yet run against DEV.
   `takeout import <mbox> --account <email> --owner <olympus email>` (the
   agent's README has the whole line), against the environment in the
   agent's `dev.env`:
   - The account is made the owner's by `POST /mail/accounts/import`
     (agents only; verification `import`; 409 if it is another user's).
   - Each kept message's metadata and snippet is published to
     `mail.messages` as `message.upsert` (`MailMetadataMessage` in
     `@ncfritz/olympus-messages`); chats, trash, spam and drafts are
     skipped.
   - The API's consumer (`olympus-api.mail-messages`) creates labels from
     the names, upserts the message by account and Gmail ID unless a
     newer snapshot is stored, and replaces its recipients, attachments
     and labels. Retries and the dead-letter queue are the calendar
     consumer's (5 s, 30 s, 5 min; ten attempts).
   - `--max-seconds` and `--limit` stop a run and print `nextOffset`;
     `--offset` resumes. A repeat rewrites the same rows.
   - Wiring: the `minerva-mail-agent` broker user (prod), its dev
     certificate in `scripts/dev-ca.sh`, and `minerva-mail-agent:agent` in
     the `AUTH_SERVICE_ROLES` examples. Redrive operations for the
     dead-letter queue, as the calendar's have, are deferred until one is
     needed.
5. **Tests**: **done** 2026-10-05 for the agent and the API; the GraphQL
   against a real Hasura is proved by M0. The parser on small synthetic
   fixture mbox files, never real mail (nested labels, quoted commas,
   multipart and attachments, odd encodings, a broken message), ID
   conversion, a fixture that proves no body text other than the snippet
   reaches a queue message, and the consumer's validation of what reaches
   a table.

**Sign-off:** M0.

**First run on DEV 2026-10-05**, the whole export into `olympus_dev`
(build `7d262f67`, Neil): a 200-message slice, then the rest from its
`nextOffset`. 275,358 messages stored: the 277,751 in the export less
2,390 chats and 3 in Trash. Four messages were dead-lettered on the first
pass: each had a Reply-To tracking address of 322–323 characters, past
RFC 5321's 320, which Gmail accepts. Message addresses now allow 1,024
(`1791210000000_minerva_mail_long_addresses`), and the four were imported
by re-running the 163 messages around them; the dead-letter queue is
empty.

What it took to run, for next time: the agent connects to the broker as
`olympus-dev` in dev, with that user's password; the API's `dev.env`
must set `AUTH_SERVICE_ROLES` once (a second line replaces the first); and
the API must have started once before the agent publishes, or the
messages have no queue to land in.

M0 is not signed off yet. Done: case 2 against the archive's counts (not
yet Gmail's), and case 3's resume and repeat. Open: 1 (ten messages
checked in Gmail), 4 (no body text in the dead-letter queue, logs or a
database dump), 5 (the archive unchanged) and 6 (no Gmail API calls).

## Phase 1b — Linking and live sync

0. **OAuth**: a new client for mail in the calendar agent's Google
   project, on its Internal consent screen, with `gmail.readonly`; the
   client secret as a file secret. Neil creates it in the Google Cloud
   console.
1. **Linking**: Connect mail account in the site, the consent flow of
   ADR 0028 (API starts it, checks `state`, hands the code to the agent).
   The verified email must match an imported account's; the subject is
   recorded then, and re-authorization must return it.
2. **Reconcile**: `getProfile` for the starting `historyId`;
   `labels.list` to give each label its ID (labels made in Gmail since
   the export are added); each label's message IDs by `messages.list`,
   and All Mail's, to bring labels and deletions up to date;
   `messages.get` only for mail after the archive's last message.
   Throttled and resumable.
3. **Incremental**: `history.list` polling from the `historyId`; added
   and removed labels, new and deleted messages; new messages fetched,
   with Gmail's snippet. A `historyId` too old (404) runs the reconcile
   again.
4. **Stars**: for each star icon, a `messages.list` with its search
   operator (`has:yellow-star`, `has:red-bang`, `has:green-check`, …)
   records which icon each starred message has, and again on each poll
   for starred messages that changed. The counts per icon show which are
   in use. Also checked: whether any write can set a particular icon, or
   only `STARRED`.
5. **Full backfill from the API** stays available (list, then get,
   throttled, resumable) for an account with no archive.
6. **Tests**: the throttle, cursor resume, reconciliation diffs, history
   handling.

**Sign-off:** M1, M2.

## Phase 2 — Audit reports and statistics

Read-only, over metadata alone.

1. **Analyses** (SQL functions or classifier jobs on metadata):
   - sender consistency: per address, domain and `List-Id`, the share of
     each label; messages off their sender's main label;
   - thread consistency: threads whose messages carry different labels;
   - label usage by year, and labels that fade as another rises;
   - duplicate roots: the same leaf under two parents, and labels with
     heavily overlapping senders (merge candidates);
   - stars: by icon, label, sender and age; near-identical messages
     starred and not; once the icons have meanings (phase 3), messages in
     an open state without the attention star, and in a closed state
     without the done star.
2. **Operations**: the statistics (KPIs, top senders, top labels, sender
   and label activity by year) and the audit results, read-only.
3. **Site**: the Statistics page, as designed. The audit's findings are
   shown on the Re-classification page without apply buttons until
   phase 4.
4. **Export**: the change plan as CSV for review outside the site.

**Sign-off:** M3, M4.

## Phase 3 — The classifier

1. **Feature store** as decided; feature version on every row.
2. **Featurize**: subject, body text and header features go to `minerva-mail-ml`
   from a pass over the Takeout archive (from Gmail only for mail newer
   than it, or with no archive); hashed word counts are kept, the text is
   not. The pass is resumable and can run beside incremental sync.
3. **Label kinds**: operations to set a label's kind, family and merge
   target, and each star icon's meaning; the families seeded with `Bills`
   (`Payable` initial and open, then `Paid`, closed). Training maps state
   labels to their family and never trains on stars as a topic.
4. **Models**: sender history, then the linear model; per-label
   calibration and thresholds.
5. **Evaluation**: train on mail before the last six months, test on the
   last six; precision and recall per label, written to the run.
6. **Retrain**: the nightly Airflow DAG.

**Sign-off:** M5.

## Phase 4 — Re-classification and writes to Gmail

1. **Suggestions over the mailbox**: out-of-fold predictions; a
   suggestion where the model is confident and disagrees with the label
   (confident learning, `cleanlab`), with the audit's findings as further
   sources.
2. **Writes**: `gmail.modify` added by a new consent; `MAIL_WRITES_ENABLED`
   on. The API records each batch before calling the agent; the agent
   checks `historyId` per message and resyncs a changed one instead of
   writing it; `batchModify` in chunks of 1,000.
3. **Operations**: list labels with their suggestion counts; list a
   label's messages with filters (changes only, change type, confidence,
   status); apply, mark processed without change, undo a batch; preview
   and apply a merge (move messages, delete the source label, rename its
   children); create sub-labels from a split.
4. **Site**: the Re-classification page and its label drill-down, as
   designed, with the bulk label picker.

**Sign-off:** M6, M7, M8.

## Phase 5 — The inbox

1. **Suggestions for new mail**: scored as it arrives.
2. **Operations**: the inbox list with suggestions; approve (with
   archive, mark read, whole thread); skip; mark read; archive; open a
   message (fetched live, not stored).
3. **Learning**: every approval and amendment is a training example,
   corrections weighed more; sender history updates at once, the linear
   model by `partial_fit`.
4. **Site**: the Mail inbox, the home page widget in the middle column,
   and the label picker, as designed.

**Sign-off:** M9, M10.

## Phase 6 — Embeddings and clusters

1. Embeddings with the text pull of phase 3 (or a second pull), the
   neighbours layer in the combined score.
2. HDBSCAN over unlabelled mail and within large labels; a 2-D map of
   sample points per run.
3. New-label and split suggestions from the clusters.
4. **Site**: the Clusters page.

**Sign-off:** M11.

## Phase 7 — Workflows, stars and filters

1. **Transitions**: a payment confirmation from a biller with an open
   `Payable` suggests moving that bill to `Paid` and its star from
   attention to done, as one suggestion; open payables by age on the
   inbox page.
2. **Stars**: new mail in an open state is suggested the attention star;
   the audit's star disagreements are offered for review. Where the API
   can only set `STARRED`, the suggestion names the icon to set in Gmail,
   and the next sync records it.
3. **Filters**: a sender whose suggestions are accepted nearly always
   (about 99 % over a minimum count) gets a proposed Gmail filter, created
   on approval, which takes it out of review. Creating filters needs the
   `gmail.settings.basic` scope, a further consent.

**Sign-off:** M12.
