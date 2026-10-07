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

| Service           | Variable                      | Default                | What                                                           |
| ----------------- | ----------------------------- | ---------------------- | -------------------------------------------------------------- |
| `minerva-mail`    | `GOOGLE_CLIENT_ID`            | —                      | Mail's own OAuth client, not the calendar agent's              |
| `minerva-mail`    | `GOOGLE_CLIENT_SECRET`        | —                      | Secret `google_mail_client_secret`                             |
| `minerva-mail`    | `MAIL_QUOTA_UNITS_PER_SECOND` | `150`                  | Kept under Gmail's per-user limit                              |
| `minerva-mail`    | `MAIL_HISTORY_POLL_SECONDS`   | `60`                   | Incremental sync interval                                      |
| `minerva-mail`    | `MAIL_WRITES_ENABLED`         | `false`                | Until phase 4; without it, write requests answer 503           |
| `minerva-mail`    | `MAIL_ML_URL`                 | —                      | The classifier                                                 |
| `minerva-mail-ml` | `OLYMPUS_API_URL`             | —                      | Metadata and suggestions                                       |
| `minerva-mail-ml` | `MAIL_ML_STORE`               | `/data/mail-ml.sqlite` | The feature store, on the service's volume                     |
| `minerva-mail-ml` | `OLLAMA_URL`                  | —                      | Optional; without it, no embeddings and no neighbours layer    |
| `api`             | `MAIL_SUGGEST_THRESHOLD`      | `0.7`                  | Default per-label threshold for showing a suggestion as ticked |

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

## Phase 1a — Import from Takeout — done 2026-10-05

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

**M0 run 2026-10-05**, DEV, build `7d262f67`, Neil and Claude:

1. **Pass.** Ten messages picked across the archive (oldest, newest, a
   three-level label, Inbox, Sent, unread and important, starred, a
   workflow label, no label header, a three-message thread) open in Gmail
   by their hexadecimal ID with the labels and flags Minerva recorded. One
   has a label header Takeout folded onto two lines
   (`Finance/Bank of America`); the parser joins it, and a test now says so.
2. **Pass, by label.** 275,358 messages match the archive less chats and
   Trash. Gmail gives no exact total for a search this large ("many"), so
   the check is per label: labels with no mail since the export, of
   several sizes, show in Gmail the same number of conversations Minerva
   counts by thread. The mailbox-wide total waits for the API's
   `getProfile` in phase 1b, and is case 7 of M2. (For the record: the
   archive holds 264,648 imported conversations, 267,035 with chats.)
3. **Pass.** The import resumed from its `nextOffset`; re-running 163
   messages changed nothing but the four it was meant to fix.
4. **Pass.** The dead-letter queue is empty. In a data dump of the mail
   tables, phrases from past the first 200 characters of ten messages'
   text matched nothing but one subject line that repeats the body's
   words; a phrase from inside each message's first 200 characters was
   found in its snippet, all ten. No message text reaches a queue, so no
   log can hold it: the agent publishes metadata and the snippet only, and
   the API logs message IDs and reasons. The dump was deleted after.
5. **Pass.** The archive is 12,058,675,283 bytes, last modified
   2026-10-03 before any import, opened read-only, and not copied; its
   SHA-256 from 2026-10-05 is
   `7232b38a80d1f8ed1b9ce7aef31871ba8b2f74cffb0bda854cd5ab7889131496`,
   for later runs to compare.
6. **Pass.** No Gmail API calls: mail's OAuth client does not exist until
   phase 1b, and the quota page shows nothing for it.

**M0 signed off 2026-10-05.**

## Phase 1b — Linking and live sync

0. **OAuth**: **done** 2026-10-06. A Web application client for mail in
   the calendar agent's Google project, on its Internal consent screen,
   with `gmail.readonly` (and `gmail.modify` registered for phase 4);
   redirect URIs `https://olympus{.dev,}.ncfritz.net/api/v1/minerva/mail/accounts/callback`.
   Client ID `MAIL_GOOGLE_OAUTH_CLIENT_ID`; the secret a file
   (`MAIL_GOOGLE_OAUTH_CLIENT_SECRET_FILE`, in prod
   `SECRETS_DIR/minerva_mail_google_oauth_client_secret`).
1. **Linking**: **built**. The Inbox page lists the mailboxes with Link to
   Gmail; `ConnectMailAccount` starts the consent flow of ADR 0028 (API
   starts it with its state and PKCE, `CompleteMailAccountConnect` takes
   the state once and hands the code to the mail agent), and the agent,
   on a services listener of its own for the API alone, exchanges it and
   keeps the refresh token, one file per mailbox. The verified address
   must be the imported account's; the subject is recorded
   (`1791260000000_minerva_mail_links`), and a later sign-in, or another
   mail account, must not bring another.
2. **Reconcile**: **built**. `gmail reconcile <email>` in the mail agent:
   `getProfile` for the starting `historyId` (and a check that the
   credential reads that mailbox); `labels.list`, matched by name
   (`SyncMailLabels` gives each label its `gmailLabelId`, adds labels made
   since the export, and names Minerva's labels Gmail lacks); each
   tracked label's message IDs by `messages.list` (user labels, `INBOX`,
   `UNREAD`, `STARRED`, `IMPORTANT`, `SENT`, `CATEGORY_*`), and All
   Mail's less drafts and chats, compared with `ListMailMessageStates`:
   differences go out as `message.labels`, mail gone from Gmail as
   `message.delete` (both new actions on `mail.messages`, guarded by
   `snapshotTime`), and `messages.get` (`format=raw`, parsed as the
   import parses) only for mail Minerva lacks. A message Minerva has and Gmail's list does not is
   deleted only when a minimal get says it is gone, or in Spam, Trash, the
   drafts or chats: mail that arrived during the run, which polling adds,
   is kept (`arrivedDuringRun`). Before that check a reconcile running
   beside the poller deleted 3 such messages; the next reconcile fetched
   them again. Throttled to 50 ms a
   request with backoff on 429, 5xx and rate-limit 403s; resumable by
   running again, since `UpdateMailAccountSync` records the `historyId`
   and Gmail's totals only after a clean run
   (`1791270000000_minerva_mail_sync`, which also moves the link's
   Google subject into the account's existing `subject`). Mail fetched
   here is not featurized; step 3 does that for new mail.
3. **Incremental**: **built**. The running agent polls every linked
   mailbox's `history.list` from its `historyId` every
   `MAIL_GMAIL_POLL_SECONDS` (60), one poll at a time (`gmail poll` does it
   once). Each message history names is brought to its state now: new
   mail, and mail out of Spam or Trash, fetched whole (`format=raw`),
   published and featurized; changed labels read with `format=minimal`
   and published as `message.labels`; deleted, or moved to Spam, Trash or
   the drafts, `message.delete` (the row goes, as at the import). Saved
   drafts and chats are passed over; a label not seen yet is read and
   synced first. The new `historyId` is recorded (`UpdateMailAccountSync`,
   with Gmail's totals) only once everything is published. No `historyId`
   yet, or a 404 for one too old, runs the reconcile, at most hourly. The
   agent finds linked accounts with `ListMailSyncAccounts`. The reconcile
   now featurizes what it fetches too; the 379 messages its first runs
   fetched were not, and wait for the next featurize of the archive or a
   backfill.
4. **Stars**: **built**. `mail_messages.star_icon`
   (`1791280000000_minerva_mail_star_icons`): a starred message's icon by
   Gmail's search name, none on one not starred. The API names only
   `STARRED`, so the reconcile runs one `messages.list` per icon and
   records each starred message's icon. The search box's names
   (`has:red-bang`) find nothing through the API (the first run found no
   icon on any of 3,723 starred messages); each icon's hidden label does
   (`l:^ss_cr`; stars `^ss_s` and a colour, the rest `^ss_c` and one). It
   reports the counts per icon and the starred messages no search found.
   A poll whose history gives or takes a star, or names a hidden icon
   label, runs the same searches. The icon rides on `message.upsert` and
   `message.labels` (absent: keep the recorded one). An icon changed
   without the star being taken off may make no history record; the next
   reconcile finds it. Takeout has no icons, so re-importing the archive
   clears them until the next reconcile. Writes: the hidden labels are
   not in `labels.list`, so whether `messages.modify` takes one (setting
   an icon) or only `STARRED` is checked with the first write, in phase 4.
5. **Full backfill from the API** stays available (list, then get,
   throttled, resumable) for an account with no archive.
6. **Tests**: the throttle, cursor resume, reconciliation diffs, history
   handling.

**Sign-off:** M1, M2.

**M2 run 2026-10-06**, DEV, Neil and Claude:

- **1. Pass.** All 484 labels have their Gmail IDs; the 4 made since the
  export were added. The 7 `IMAP_*` labels of the export are not in
  Gmail's API, and came off the messages that had them.
- **2. Pass.** The first reconcile relabelled 6,228 messages and fetched
  the 376 newer than the archive (one failed and was fetched by the
  second); the second changed nothing and fetched the 2 that had arrived.
  No message had been deleted in Gmail since the export; deletion passed
  with history polling (case 4).
- **3. Pass, at twice the estimate.** A run sends 2,190 requests
  (about 11,000 quota units, nine minutes at the throttle's pace), against
  ADR 0030's "about a thousand": the estimate left out that each of the
  484 labels takes at least one list call, besides All Mail's 552 pages.
  Still under 1 % of the 278,000 gets a backfill would take, which is the
  ADR's point.
- **4. Pass.** With the agent polling every 60 s, a label added to a
  message in Gmail showed on it in Minerva, and a message deleted in
  Gmail was gone from Minerva, both within two polls.
- **5. Pass.** The mail tables take 418 MB for the mailbox.
- **6. Pass.** With the icons searched by their hidden labels, 3,710 of
  the 3,723 starred messages were recorded with their icons (green check
  3,644, yellow star 24, orange guillemet 23, blue info 15, red bang 3,
  yellow bang 1); Minerva's counts per icon match the report's, and the
  three messages Neil gave the red bang are Gmail's `has:red-bang`. The
  13 starred without an icon have none of the hidden icon labels.
- **7. Pass.** Gmail's 278,125 messages and 267,404 threads, less 2,390
  chats in 2,385 threads (Spam, Trash and drafts empty), are 275,735 and
  265,019; Minerva holds exactly 275,735 messages in 265,019 threads.

## Phase 2 — Audit reports and statistics — built 2026-10-05, not signed off

Read-only, over metadata alone. Measured on a synthetic mailbox the size
of Neil's (275,358 messages, 482 labels, one sender with 43 %); the real
numbers come with the sign-off on DEV.

1. **Analyses**: **built**.
   - Statistics are SQL functions computed on request
     (`1791220000000_minerva_mail_statistics`): the summary, top senders
     and labels, and their mail per year, by range and scope. About 2 s
     of database time per page.
   - The audit is a kept run (`1791230000000_minerva_mail_audit`):
     `mail_run_audit` replaces each account's last run, in about 3.5 s,
     so the page, the drill-down and the export read one set, and phase 4
     can add a status to each proposal.
     - **Sender consistency**: a sender of five or more received messages
       with one label on four in five of them gets it where it is missing
       (confidence: the share), and loses a label it has on fewer than one
       in ten (confidence: one less that share).
     - **Thread consistency**: threads whose messages carry different
       user labels.
     - **Merge candidates**: a duplicated root (a top-level label and
       another with the same leaf, `Advertisements` and
       `Accounts/Advertisements`), or labels where three in five of the
       smaller one's senders (with two messages or more under it) are the
       larger's, a label and its own parent or child excepted. The same
       leaf under two parents is often deliberate (`Amazon/Receipts`,
       `Apple/Receipts`), so it counts only by senders.
     - **Stars**, live: by label, sender and age, and near-identical mail
       (one sender, subjects equal once digits are set aside) starred and
       not. Takeout has no star icon, so stars of any kind until 1b; the
       state checks wait for label kinds (phase 3).
   - Label fade shows on the Statistics heatmap and as "no mail in two
     years" on the label tree, rather than as a rule of its own.
2. **Operations**: **built**. `GetMailStatistics`; `RunMailAudit`,
   `GetMailAudit`, `ListMailAuditChanges` (paged; by label, action and
   confidence).
3. **Site**: **built**. The Statistics page; the Re-classification page
   with the audit's strip, label tree, merge candidates, mixed threads
   and stars, and a label's review. No apply buttons until phase 4.
4. **Export**: **built**. `ExportMailAuditChanges`: the change plan as
   CSV, a row per proposed change, with the same filters as the review.

**Sign-off:** M3, M4.

## Phase 3 — The classifier — done 2026-10-06

1. **Feature store**: **built**. SQLite on the classifier's volume
   (`FEATURE_STORE_PATH`): per feature version, each message's hashed
   token counts (2^18 columns: subject, the body's first 5,000
   characters, sender, domain, list, unsubscribe header, attachment
   types) as compressed arrays, and the sender and list beside them; no
   text. A version is `building` until its pass completes, then `ready`;
   the newest ready version serves.
2. **Featurize**: **built** for the archive. `takeout featurize` in the
   mail agent sends batches of 200 messages' text over mutual TLS to the
   classifier's services listener (`POST /v1/features`, the agent's
   certificate only), resumable by byte offset, and completes the version
   at the end of the archive (`--no-complete` to hold it). From Gmail
   comes with 1b.
3. **Label kinds**: **built** (`1791240000000_minerva_mail_label_kinds`;
   the Labels page). `ListMailLabels`, `UpdateMailLabel` (topical, or
   retired into a target), `ListMailLabelFamilies`,
   `CreateMailLabelFamily`, `DeleteMailLabelFamily`. Families are
   suggested from sibling labels starting `*` (`Bills/*Payable`,
   `Bills/*Paid`) rather than seeded. Star meanings move to 1b, since
   Takeout has no star icons.
4. **Training data**: **built**. `ListMailTrainingAccounts`,
   `ListMailTrainingExamples` (keyset pages by Gmail ID, up to 5,000) and
   `ListMailTrainingLabels`, agents only: metadata and targets, never text.
   A topical label is a topic; a state counts as its family; a retired
   label as its merge target's mapping; system labels and stars never.
5. **Models**: **built**. Sender history (address, else list, else
   domain; one-year half-life) and one-vs-rest logistic regression (SGD,
   older mail weighing less), combined per label by a small logistic
   regression fitted on the validation months: the calibration. Each
   label's threshold is 0.5, raised only for a label below 90% precision
   there on validation, to the lowest score that reaches it; a label that
   never gets there is never ticked. (Thresholds tuned freely per label
   lost to 0.5 on both precision and recall in the first real run,
   2026-10-06.) A predicted family suggests its initial label.
   `POST /v1/suggestions` answers from the serving model.
6. **Evaluation**: **built**. Test: the last six months; validation: the
   six before; training: everything older. Precision and recall per label,
   at its threshold and at 0.5, written to the run
   (`MODEL_DIR/runs.sqlite3`), with the mean over labels with five or more
   test messages, coverage and top-suggestion accuracy;
   `minerva-mail-ml-train report` prints it. The newest ready run serves;
   a failed run leaves the last.
7. **Retrain**: **built**, paused. `minerva_mail_retrain`, nightly, runs
   `minerva-mail-ml-train run` in the classifier's image with its data
   directory. Unpaused once the classifier is in the deployed stack.

Not yet: embeddings (phase 6), online updates from decisions (phase 5).

**Sign-off:** M5, against the whole archive: 255,056 received messages
featurized (`v1`), 481 targets, run `6ca3f45f` (about three minutes).

1. **Pass.** Trained before 2025-10-03, validated to 2026-04-03, tested on
   the 16,300 messages since. Recorded per label; the baseline, at 0.5:
   precision 98.5%, recall 95.7%. At each label's threshold: 98.7%,
   94.6%. Over the 117 labels with five or more test messages, 79.9% and
   76.8%: the shortfall is labels new since the split (`ecobee`,
   `Claude`, `Paprika`), senders that changed (`Microsoft`, `Meetup`), and
   catch-alls (`Registrations & Confirmations`), for phase 5's learning
   from decisions.
2. **Pass.** With the Bills family made, `family:Bills → Bills/*Payable`
   scored 91.6% precision and 97.6% recall on 167 test bills; `*Paid` is
   no longer a target, so it cannot be suggested. Before the family
   existed, `Bills/*Paid` trained as a topic, which is the failure this
   case guards against.
3. **Pass, by test** (`test_completing_a_version_makes_it_serve`); a
   second pass over the archive for a new version was not worth its
   hours (Neil, 2026-10-06).

The first run's thresholds, tuned freely per label, lost to 0.5 on both
precision and recall; they now start at 0.5 and only rise (item 5). A few
still rose on three or four validation suggestions (`Nest`, `Uber`);
left until phase 5 has decisions to measure them against.

**M5 signed off 2026-10-06.**

## Phase 4 — Re-classification and writes to Gmail

1. **Suggestions over the mailbox**: **built** 2026-10-06, before 1b, since
   it needs only the archive. `minerva-mail-ml-train suggest` scores every
   message by layers fitted on the other four fifths of the mail (folds by
   Gmail ID) and the serving model's combiner; per label, confident
   learning (`cleanlab`, its thresholds capped at 0.9 because the scores
   are calibrated) finds where a label disagrees with the score. Each is a
   suggestion to add or remove that label; a family is only added, as its
   initial state. Additions are ticked at the label's threshold, removals
   from 0.9. They are posted as a kept run per account
   (`1791250000000_minerva_mail_suggestions`: `CreateMailSuggestionRun`,
   `CreateMailSuggestions`, `PublishMailSuggestionRun`, agents only) and
   read through `mail_proposals`, the view over the audit's changes and the
   classifier's: the Re-classification page counts both, and a label's
   review filters by source and fades what is unticked. The nightly DAG
   suggests after it trains.
2. **Writes**: **built**. `gmail.modify` added by a new consent ("Allow
   changes" on the Inbox) once the agent's `MAIL_WRITES_ENABLED` is on;
   the API's `MINERVA_MAIL_WRITES_ENABLED` gates applying and undoing
   (503 when off). `1791290000000_minerva_mail_changes`: the change log
   (`mail_change_batches`, `mail_changes`, `mail_change_labels`, each
   message's user labels before and what was added and removed, by name
   so it outlives a merged label) and `mail_decisions` (a proposal
   applied, or processed without change), which `mail_proposals` shows.
   `ApplyMailChanges` records a batch and hands it to the agent
   (`StartGmailWrites`), which writes in the background and reports each
   message's outcome (`UpdateMailChangeBatch`): written, already so,
   changed in Gmail since (synced, not written), gone, or failed;
   `batchModify` 1,000 a call, messages with the same change together.
   **Not as ADR 0030 says**: instead of each message's `historyId`, which
   Minerva does not keep, the agent compares the message's user labels in
   Gmail with those the batch recorded; it is the same guard against
   overwriting a change made by hand. `UndoMailChangeBatch` writes the
   reverse of what an apply wrote, against the labels it left, and takes
   back its decisions; a batch is undone once. `DismissMailProposals`
   marks proposals processed. `ListMailChangeBatches` and
   `DescribeMailChangeBatch` are the change log. Only labels Gmail has
   (with a Gmail ID) are written; new labels, merges and splits are step 3.
3. **Operations**: list labels with their suggestion counts; list a
   label's messages with filters (changes only, change type, confidence,
   status); apply, mark processed without change, undo a batch; preview
   and apply a merge (move messages, delete the source label, rename its
   children); create sub-labels from a split. **Built so far**: the
   status filter (`status=open|processed` on ListMailAuditChanges and the
   export, which gains a `decision` column); processed counts in the label
   tree and the summary (`1791300000000_minerva_mail_processed`);
   `ApplyMatchingMailProposals` and `DismissMatchingMailProposals`, the
   review's "apply all" and "mark all processed" over what its filters
   match (open proposals only; applying leaves the classifier's unticked
   ones, and a label one proposal adds and another removes; one batch per
   mailbox, more past 10,000 messages). Then label operations
   (`1791310000000_minerva_mail_label_ops`): a batch can create, rename and
   delete labels as well as move messages; the agent creates and renames
   first (reported before any message, so Minerva renames its label row,
   keeping its messages, kind and family), writes the messages, then
   deletes, and deletes a label only once Gmail says it is empty (else
   "skipped"). `ApplyMailChanges` takes `newLabels` to create first (a
   split's sub-label, later the picker's new labels). `PreviewMailLabelMerge`
   and `MergeMailLabels`: every message with the label moves to the one
   kept; each child is renamed under it, or, where the label kept has a
   child of that name, emptied into it; the labels emptied are deleted; one
   batch (kind `merge`, at most 50,000 messages). Undo reverses label
   operations too (a delete by a create, a rename by its rename back, a
   create by a delete once empty), comparing messages in today's names.
   Site: Preview merge on each merge candidate and Merge labels for any
   two; Move to new sub-label on a label's review (a split by hand: split
   suggestions come with clustering, phase 6); the change log shows each
   batch's label operations.
4. **Site**: the Re-classification page and its label drill-down, as
   designed, with the bulk label picker. **Begun**: the label review
   selects proposals (decided ones show Applied or Processed and cannot
   be selected) and applies them to Gmail, one batch per mailbox, or marks
   them processed; Mail › Change log lists the batches, follows one being
   written, shows each message's change and outcome, and undoes an apply.
   Then the label picker (`LabelPicker`, its logic in
   `apps/site/src/utils/labelPicker.ts`): Suggested, On these messages and
   Recent (kept in the browser) before typing; typing matches the path in
   order, ties to the more used; a state replaces its family's other
   states and a retired label applies its merge target, each saying so; a
   path that does not exist is offered to create (`newLabels`); the
   Changes line. In bulk ("Change labels…" on the review's selection),
   each label's checkbox has three states with "on 7 of 12" or "adding to
   5 · already on 7"; one batch per mailbox. A label's review shows its
   processed bar. **Not yet**: "Often used for this sender" (nothing serves
   a sender's label history; it matters most for one message, the Inbox's
   panel in phase 5), the split alert (built with clustering, phase 6),
   and the picker's Tab and ⌘↵ keys (design.md,
   Open 1).

**Sign-off:** M6, M7, M8.

**M7 run 2026-10-06**, DEV, Neil and Claude, after re-linking with
`gmail.modify`:

- **1. Pass.** Three proposals applied changed exactly those labels in
  Gmail; the batch is in the change log, three written.
- **2. Pass.** Undoing it put Gmail's labels back as they were.
- **3. Pass.** A message relabelled by hand in Gmail before its apply (with
  polling off) came back "Changed in Gmail": its labels were left as they
  were in Gmail and synced to Minerva. (Its suggestion is recomputed by the
  next nightly suggest run, not at once.)
- **4. Pass.** With `MINERVA_MAIL_WRITES_ENABLED` unset, applying answered
  503 and Gmail was unchanged.

## Phase 5 — The inbox

1. **Suggestions for new mail**: scored as it arrives. **Built**
   2026-10-06. New mail a poll or reconcile fetches is featurized, then
   scored in the same batch by the classifier's serving model
   (`POST /v1/suggestions`, the text in memory only), and its labels are
   recorded with `RecordMailMessageSuggestions` (agents only;
   `1791320000000_minerva_mail_message_suggestions`: `mail_message_scores`, a
   row per message scored, by which model run, and
   `mail_message_suggestions`, its labels best first with score and
   ticked). Unlike the mailbox-wide run's proposals, these are the whole
   suggestion, labels the message has already included. Keyed by account
   and Gmail ID, since the message reaches Minerva through
   `mail.messages` and may land after its suggestions; deleting a message
   deletes them. No model for the account yet: nothing is scored, said
   once. Polls and reconciles report `suggested` and `suggestFailed`; a
   failure to score fails no sync. `gmail suggest <email>` scores what is
   in the inbox now (mail from before). Re-scoring after the nightly
   retrain is step 3's.
2. **Operations**: the inbox list with suggestions; approve (with
   archive, mark read, whole thread); skip; mark read; archive; open a
   message (fetched live, not stored). **Built so far**: a change batch may
   take Gmail's `INBOX` and `UNREAD` off (archive, mark read) or put them
   back, logged and undone like labels; the agent's "changed in Gmail
   since" guard compares user labels only, as read state changes all the
   time. `1791330000000_minerva_mail_inbox`: `mail_inbox_decisions`
   (approved or skipped per message, the model run, amended, the batch)
   and the `mail_inbox` view (each message in the inbox, or decided: its
   thread's size, its best ticked suggestion it lacks, its decision).
   `ListMailInbox` (`review`, `unread`, `approved` since a time, `all`;
   search, minimum confidence, by received or confidence; the statistics
   strip's counts). `ApproveMailMessages` (each message's labels from the
   picker, archive, mark read, whole thread; one batch, and an approval
   per message in the inbox, amended when its labels are not the ticked
   suggestion's; undoing the batch takes them back), `SkipMailMessages`,
   `UpdateMailMessageFlags` (archive or mark read alone). Then
   `GetMailMessageContent`: the API checks the caller owns the mailbox
   and asks the agent (`GET /v1/gmail-messages/:gmailId`), which reads
   the message live (`format=raw`) and returns its headers, text and HTML
   bodies (each cut at 1,000,000 characters) and what is attached,
   without the content; nothing stored, logged or cached (`no-store`).
   The HTML is as sent: the site shows it in a sandboxed frame with
   remote content blocked. **Step 2 built.**
3. **Learning**: every approval and amendment is a training example,
   corrections weighed more; sender history updates at once, the linear
   model by `partial_fit`. **Built** 2026-10-06. The API: training
   examples carry their inbox `decision` (`approved`, `amended`);
   `ListMailTrainingDecisions` lists approvals in order after a cursor,
   each `ready` once the batch writing its labels has finished;
   `ListMailInboxToScore` gives what is to review. Training weighs an
   approval 1.5 and a correction 3 (times recency), in sender history and
   the linear model. The service learns every `LEARN_SECONDS` (60; 0 off):
   approvals since the serving run began, in order, up to the first not
   ready, from their stored features (no text): sender history counts each
   under every key it has, and a correction first halves the history of
   its most specific key (`CORRECTION_DECAY`), since that sender's mail is
   labelled differently now; the linear model takes one gradient step on
   log loss per message (`ONLINE_RATE` 0.5 times its weight) for targets
   with a model; a label new since the retrain waits for it. What a run
   learned is in the registry (`online_learned`, `online_cursors`) and
   replayed when it loads; then the inbox is scored again. Nightly: train,
   suggest, then `score-inbox` (the DAG's third task). `learn` and
   `score-inbox` also run alone. **M10 case 1, measured** on the synthetic
   mailbox (a sender of about 300 consistent messages): two corrections
   lower its label (0.999 to 0.93) and raise the new one; the third makes
   the new one a suggestion, the fourth puts it first. A sender with less
   history moves sooner. The case as written ("twice changes the next
   suggestion") holds for the scores, not the top label: to settle with
   Neil at sign-off.
4. **Site**: the Mail inbox, the home page widget in the middle column,
   and the label picker, as designed. **Built** 2026-10-06. Mail › Inbox: the
   statistics strip; To review, Unread, Approved today and All, search,
   minimum confidence, newest or most confident; a table (From, Subject
   and snippet, Current labels, Suggested, Received) with Approve as
   suggested and Open on each row; a selection bar (Approve suggested,
   Skip, Mark read, Archive); Accept all ≥ 90%; each row expanding into the
   review panel (who, when, thread; each suggestion with its checkbox,
   confidence bar and reason; the label picker for one message; Archive,
   Mark read and Whole thread, remembered in the browser; Approve & apply,
   Skip, Open message). The mailboxes fold away once one is linked. Open
   message: headers, attachments by name and size, the HTML in a sandboxed
   frame (no scripts, forms or same-origin; a policy blocking everything
   remote, images included; a refresh removed; links to a new tab) and the
   plain text. The home page's Mail widget, under the calendar: To review,
   Unread and Approved with counts, Accept all ≥ 90%, ten rows, one
   expanded at a time into the same panel; approving folds the labels into
   the row with Undo. The change log shows archiving and marking read as
   such. Checked rendered against stubbed API answers (synthetic mail);
   the reason line says the classifier's confidence, not yet sender
   history's counts ("47 of 48"), which suggestions do not carry.

**Sign-off:** M9, M10.

## Phase 6 — Embeddings and clusters

1. Embeddings with the text pull of phase 3 (or a second pull), the
   neighbours layer in the combined score. **Built** 2026-10-06, with Ollama
   (`nomic-embed-text`, Neil, 2026-10-06; no bundled model). The
   classifier's `OLLAMA_URL` and `EMBED_MODEL`: vectors cut to 384
   dimensions (the model is Matryoshka-trained), unit length, int8, in the
   feature store under an embedding version (`nomic-embed-text-384`),
   building until the archive's pass completes it. New mail is embedded
   as it is featurized (`POST /v1/features`; a model that fails fails no
   featurizing); the archive by `takeout featurize --embed`
   (`POST /v1/embeddings`, `/complete`, `/versions`). What is read: the
   subject and the body's first 2,000 characters, with nomic's
   `classification:` prefix. The neighbours layer: a run trained with a
   ready embedding version keeps every message's vector and labels; a
   message scores, per label, the similarity-weighted share of its 25
   nearest (exact search in chunks), pulled toward the overall rate, and
   the combiner takes its log-odds and the neighbours' mean similarity as
   two more inputs (fitted on the same time split; a model from before
   scores as it did). `/v1/suggestions` embeds what it scores; inbox
   scoring and online learning read stored vectors, and an approval joins
   the index. Runs report the embedding version and how many messages had
   a vector.
2. HDBSCAN over unlabelled mail and within large labels; a 2-D map of
   sample points per run. **Built** 2026-10-06:
   `minerva-mail-ml-train cluster` (the nightly DAG's fourth task, after
   inbox scoring) reads the serving features and embeddings, reduces the
   vectors to 32 dimensions (PCA) and runs HDBSCAN on a sample of at most
   20,000 per scope, the rest joining the nearest group within its usual
   radius. Scopes: the unlabelled mail, and each topic label with 300 or
   more messages (a family's mail is one kind in different states, so
   never). The map is t-SNE over about one message in 50 (2,000 to 6,000
   points). `1791340000000_minerva_mail_clusters`: a run per account
   (`mail_cluster_runs`), its clusters with label and sender counts, their
   members and the map's points; posted by `CreateMailClusterRun`,
   `CreateMailClusters`, `CreateMailClusterMembers`,
   `CreateMailClusterPoints` and `PublishMailClusterRun` (agents only),
   which drops the account's runs before it. Synthetic mailbox: about six
   seconds for 6,000 messages.
3. New-label and split suggestions from the clusters. **Built**: a group
   of 30 or more unlabelled messages whose top three sender domains send
   80% of it suggests a new label named after its top domain; a label with
   two or more groups of at least a tenth of it each, whose top senders'
   domains differ, suggests each as a sub-label (`Travel/Air`). Read by
   `GetMailClusterMap`, `DescribeMailCluster` (its 20 newest messages'
   metadata), `ListMailClusterMembers` (its Gmail IDs, 5,000 a page) and
   `ListMailClusterSuggestions` (`?label=` for one label's splits).
   Applying one is an ordinary `ApplyMailChanges` with `newLabels`: a new
   label added to the cluster's messages, or a split's messages moved from
   the label into the sub-label, 10,000 a batch, each undoable.
4. **Site**: the Clusters page. **Built**: the map (Highcharts scatter, a
   colour per top-level label, the busiest ten, then other labels and
   unlabelled; the 15 largest clusters, those suggesting first, named
   where they sit; zoom by dragging); selecting a dot or a name shows the
   cluster in the side panel, its label mix, purity, top senders, newest
   messages and suggestion (Create label or Create sub-label, and a link
   to its re-classification), then the clusters worth a look. The cluster
   and mailbox are in the address (`?cluster=`, `?accountId=`). A label's
   review shows the split alert from phase 4 step 4: the proposed
   sub-labels and their counts, Preview (the map, on the first group) and
   Create sub-labels. **Not yet**: the Re-classification page's split
   count and the label tree's "split suggested" flag; colouring by
   suggested label.

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
