# Email management: functional sign-off

One test plan per flow of
[ADR 0030](../../decisions/0030-email-management.md) and the
[design](design.md), used to sign off each phase of the
[plan](README.md). Automated tests cover the rules; these checks prove
the flows on the real pieces: Gmail, the agents, Hasura, the API, the
site.

## Environments

| Id       | Where                                                            | Used from |
| -------- | ---------------------------------------------------------------- | --------- |
| **DEV**  | the API, site and agents from the workspace against `hasura-dev` | phase 1   |
| **PROD** | the Mac Mini's `olympus` stack                                   | phase 4   |

Phases 1–3 run against Neil's real mailbox read-only. Before phase 4's
first write, every write case runs first against a test label set
(`zz-test/*`) on a few hundred messages.

## Fixtures

| Fixture     | What                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| `user-a`    | Neil, signed in, with the Workspace account                             |
| `user-b`    | a second signed-in user with no mail account                            |
| `test-set`  | about 300 messages labelled `zz-test/a`, `zz-test/b`, `zz-test/a/child` |
| `bill-pair` | a bill and its payment confirmation from the same sender                |

Every run records: date, environment, build (git commit), who ran it,
and per case pass/fail with the evidence named in the case. A phase is
signed off when every case listed for it passes, or a failure has an
accepted, recorded exception.

## M1 — Linking the account

1. `user-a` connects the account from the site; it is listed with
   `consent` and a time.
2. Re-authorizing with a different Google account is refused and the
   stored credential still works.
3. `user-b` sees no account and gets 404 for `user-a`'s.
4. The refresh token is in the agent's store only; the API's logs and
   Hasura hold none.

## M2 — Sync

1. Labels match Gmail's, with parents from the `/` path.
2. Backfill stopped halfway resumes from its cursor without duplicates;
   the message count matches Gmail's within the sync window.
3. A label added in Gmail shows within two poll intervals; a message
   deleted in Gmail is marked deleted.
4. No body text beyond the snippet: a search of the dead-letter queue,
   the logs and a database dump for a known sentence from past the first
   200 characters of a fixture message finds nothing.
5. The database holds well under 1 GB for the mailbox.
6. Messages starred with two different icons in Gmail are recorded with
   those icons; the counts per icon match Gmail's searches.

## M3 — Audit reports

1. A sender with a few messages off its main label lists them.
2. A thread with mixed labels is listed.
3. `Accounts/Advertisements` and `Advertisements` are a merge candidate.
4. The CSV export opens with one row per proposed change.

## M4 — Statistics

1. Totals match the database; top senders and labels match a direct
   query.
2. The range and scope controls change every chart.

## M5 — The classifier

1. The time-split evaluation is recorded per label; the overall
   precision at the default threshold is recorded as the baseline.
2. A state label trains as its family: a new bill is suggested `Payable`,
   never `Paid`.
3. Re-running featurization with a new feature version leaves the old
   version serving until it completes.

## M6 — Suggestions over the mailbox

1. Messages planted in `test-set` with the wrong label are suggested
   back to the right one.
2. Counts per label in the site match the database.

## M7 — Writes to Gmail

1. Applying three suggestions on `test-set` changes exactly those labels
   in Gmail, and the batch is in the change log.
2. Undo restores Gmail's labels as they were.
3. A message relabelled by hand in Gmail after its suggestion is synced
   again, not overwritten, and its suggestion is recomputed.
4. With `MAIL_WRITES_ENABLED=false`, apply answers 503 and Gmail is
   unchanged.

## M8 — Merges and splits

1. Merging `zz-test/b` into `zz-test/a` moves its messages, deletes the
   label, and renames its children under the target.
2. Creating sub-labels from a split moves the proposed messages and
   leaves the rest.

## M9 — The inbox

1. New mail appears with suggestions within two poll intervals.
2. Approve with Archive and Mark read: the labels are written, the
   message leaves the inbox and is read, in Gmail too.
3. Opening a message shows its body; nothing of it is stored.
4. The home widget's counts match the Inbox page's.

## M10 — Learning

1. Amending a sender's suggestion twice changes the next suggestion for
   that sender.
2. A label created in the picker exists in Gmail after apply and is
   suggested for similar mail after the nightly retrain.

## M11 — Clusters

1. The map shows the run's clusters; selecting one shows its label mix
   and senders.
2. A cluster of unlabelled mail with a tight sender set is proposed as a
   new label.

## M12 — Workflows, stars, filters

1. `bill-pair`: the confirmation suggests moving the bill from `Payable`
   to `Paid` and its star from attention to done, in one suggestion.
2. A sender at the acceptance threshold gets a filter proposal; approving
   it creates the filter in Gmail.
3. A `Payable` bill without the attention star, and a `Paid` one still
   carrying it, are both listed by the audit and fixed on approval (or,
   where only `STARRED` can be written, the suggestion names the icon
   and the next sync records it once set in Gmail).
