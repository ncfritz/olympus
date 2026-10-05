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
| 0     | ADR accepted; OAuth client; empty feature in the model, API and site; the two agents' skeletons | —          | —              |
| 1     | The account linked; labels and message metadata synced: backfill, then history polling          | 0          | M1, M2         |
| 2     | The audit on metadata (read-only reports); the Statistics page                                  | 1          | M3, M4         |
| 3     | The classifier: features, sender history and linear model, offline evaluation; label kinds      | 1          | M5             |
| 4     | Re-classification: suggestions over the mailbox; review and bulk apply to Gmail; merges, splits | 2, 3       | M6–M8          |
| 5     | The Mail inbox, the home page widget, the label picker; online learning from every decision     | 3, 4       | M9, M10        |
| 6     | Embeddings, the Clusters page, new-label suggestions                                            | 3          | M11            |
| 7     | Workflow transitions (Payable → Paid), stars, Gmail filter proposals                            | 5          | M12            |
| Later | A local LLM for cluster names and cold-start labels; iOS; other mail accounts                   |            |                |

Phases 2 and 3 are independent of each other once phase 1 is in. Phase
6 can start any time after 3.

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
| Gmail agent    | `agents/mail/`: NestJS, `providers/gmail/`, `sync/`, `writes/`, `store/` (sync cursors only)                                                                                        |
| Classifier     | `agents/mail-ml/`: Python, `pyproject.toml`, `src/mail_ml/` (`features/`, `store/`, `models/`, `audit/`, `api/`), `tests/`                                                          |
| Feature store  | `agents/mail-ml`'s volume: a SQLite database, embeddings loaded into memory; not backed up (rebuilt from Gmail)                                                                     |
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

| Service   | Variable                      | Default                | What                                                            |
| --------- | ----------------------------- | ---------------------- | --------------------------------------------------------------- |
| `mail`    | `GOOGLE_CLIENT_ID`            | —                      | Mail's own OAuth client, not the calendar agent's               |
| `mail`    | `GOOGLE_CLIENT_SECRET`        | —                      | Secret `google_mail_client_secret`                              |
| `mail`    | `MAIL_QUOTA_UNITS_PER_SECOND` | `150`                  | Kept under Gmail's per-user limit                               |
| `mail`    | `MAIL_HISTORY_POLL_SECONDS`   | `60`                   | Incremental sync interval                                       |
| `mail`    | `MAIL_WRITES_ENABLED`         | `false`                | Until phase 4; without it, write requests answer 503            |
| `mail`    | `MAIL_ML_URL`                 | —                      | The classifier                                                  |
| `mail-ml` | `OLYMPUS_API_URL`             | —                      | Metadata and suggestions                                        |
| `mail-ml` | `MAIL_ML_STORE`               | `/data/mail-ml.sqlite` | The feature store, on the service's volume                      |
| `mail-ml` | `OLLAMA_URL`                  | —                      | Optional; without it, embeddings come from a bundled ONNX model |
| `api`     | `MAIL_SUGGEST_THRESHOLD`      | `0.7`                  | Default per-label threshold for showing a suggestion as ticked  |

## Phase 0 — Decision and scaffolding

1. **ADR 0030 accepted**.
2. **OAuth**: a new client for mail in the calendar agent's Google
   project, on its Internal consent screen, with `gmail.readonly`; the
   client secret as a file secret.
3. **Model and API**: `minerva/mail/index.ts`; `MailModule` in
   `MINERVA_MODULES`, no operations.
4. **Agents**: `agents/mail` from the agent template, metrics listener,
   no handlers; `agents/mail-ml` with `pyproject.toml`, ruff, pytest, a
   health route and a Dockerfile in the central build.
5. **Conventions**: `docs/conventions/python.md` and its line in
   `CLAUDE.md`.
6. **Site**: a Mail sub-menu in Minerva's menu (`mail-container`, after
   Meetings, with its path matchers) holding Inbox, Re-classification,
   Statistics and Clusters, each an empty page under
   `pages/minerva/mail/` behind sign-in.

**Sign-off:** both agents and the API boot; the menu opens the pages;
the Turbo tasks and the classifier's checks pass.

## Phase 1 — Account and sync

1. **Migration**: `mail_accounts`, `mail_labels`, `mail_messages` and
   its recipient, attachment and label tables.
2. **Linking**: Connect mail account in the site, the consent flow of
   ADR 0028 (API starts it, checks `state`, hands the code to the agent);
   re-authorization must return the stored subject.
3. **Labels**: the agent lists Gmail's labels and the API mirrors them,
   parents derived from the `/` path.
4. **Backfill**: list, then get with `format=full`, throttled, resumable
   from the stored page token. Headers and attachment metadata are kept;
   the body is dropped (until phase 3 sends it to the classifier).
   `mail.messages` carries metadata only; the API consumes it into the
   tables, with the retry and dead-letter handling of the calendar
   consumer.
5. **Incremental**: `history.list` polling from the last `historyId`;
   added and removed labels, new and deleted messages. A `historyId` too
   old (404) starts a resync of the changed window.
6. **Stars**: for each star icon, a `messages.list` with its search
   operator (`has:yellow-star`, `has:red-bang`, `has:green-check`, …)
   records which icon each starred message has, during backfill and again
   on each poll for starred messages that changed. The counts per icon
   show which are in use. Also checked: whether any write can set a
   particular icon, or only `STARRED`.
7. **Tests**: converters, the throttle, cursor resume, history handling,
   a fixture that proves no body text other than the snippet reaches a
   table, and none reaches a queue message or a log.

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
2. **Featurize**: the agent sends each message's subject, body text and
   header features to `mail-ml` during a second pass over the mailbox
   (the text pull); hashed word counts are kept, the text is not. The pass
   is resumable and can run beside incremental sync.
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
