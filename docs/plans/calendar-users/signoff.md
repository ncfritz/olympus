# Calendar users: functional sign-off

One test plan per flow of
[ADR 0028](../../decisions/0028-minerva-calendar-ownership.md), used to
sign off each phase of the [plan](README.md). Automated tests cover the
rules; these checks prove the flows on the real pieces: Hasura, the API,
the sync agent, RabbitMQ, the notification agent, the site, and Google
and Microsoft.

## Environments

| Id       | Where                                                                                 | Used from |
| -------- | ------------------------------------------------------------------------------------- | --------- |
| **DEV**  | the API, site and sync agent from the workspace against `hasura-dev`, `/dionysus-dev` | phase 1   |
| **PROD** | the Mac Mini's `olympus` stack                                                        | phase 1   |

## Fixtures

| Fixture      | What                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| `neil`       | Neil, signed in with Google; owns every row from before the change                        |
| `user-b`     | a second user, signed in with GitHub, with no data                                        |
| `acct-sign`  | the Google account Neil signs in with, already connected to the agent                     |
| `acct-other` | a second Google account of Neil's, already connected to the agent, not a sign-in identity |
| `acct-ms`    | a Microsoft 365 account Neil controls, not yet connected                                  |
| `acct-new`   | a Google account `user-b` controls, not yet connected                                     |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

## C1 — Minerva per user

1. After the migration, `neil` sees the same calendar items, notes and
   statistics for last week as before it (compare the counts recorded
   before).
2. `user-b` sees no calendar items, notes or statistics, and gets 404 for
   one of `neil`'s meetings and notes by ID.
3. A note `user-b` creates is theirs; `neil` gets 404 for it.
4. A request with no token to any meetings or notes operation is refused
   (401).
5. `infra/hasura/tests/minerva_calendar_users.sql` passes against the
   environment's database.

## C2 — Accounts by subject

1. After the agent starts, `acct-sign` and `acct-other` list with their
   subjects.
2. Re-authorizing `acct-other` and choosing `acct-sign` at Google's screen
   is refused, and `acct-other` still syncs.
3. Adding a calendar with an existing `source` is refused (409).
4. A changed event on `acct-other` reaches `calendar.events` with
   `account` naming its subject (read from a bound test queue).

## C3 — The API calls the agent

1. The API lists the agent's accounts over the service listener.
2. `curl` to the service listener without a certificate fails the
   handshake; with a device certificate it is refused.

## C4 — Linking by sign-in

1. After `neil` signs in, `acct-sign` is his (`sign_in`), and
   `acct-other` is listed as unowned to no one.
2. `user-b` connecting `acct-sign` is refused.

## C5 — Connecting from the site

1. `neil` connects `acct-ms` from a browser that is not on the Mac Mini;
   it is his (`consent`), with its subject `<tid>:<oid>`.
2. `neil` adds one of its calendars, pauses it and resumes it.
3. Replaying the callback URL is refused; a callback ten minutes late is
   refused.
4. `user-b` gets 404 for `acct-ms` and its calendars.

## C6 — Events reach their owner

1. An event added to `acct-sign`'s calendar in Google appears in `neil`'s
   calendar in Minerva within a sync interval; `user-b` never sees it.
2. Deleting it in Google marks it deleted in Minerva.
3. Events of the still-unowned `acct-other` are counted as `unowned` and
   not stored.
4. The same message delivered twice leaves one meeting, unchanged.
5. Linking an account that already has events at the agent (connect it,
   or sign in with it) brings them into Minerva without a change in
   Google: the backfill.
6. RabbitMQ shows `olympus-api.calendar-events` bound to `event.*` with a
   consumer, and `olympus-api.calendar-events.dead` empty; the metric
   `calendar_events_consumed_total` appears on the API's `/metrics`.

## C7 — Claims

1. `neil` claims `acct-other` by its email; the email arrives at that
   address.
2. Opening the link signed in as `user-b` refuses and says why; nothing
   changes.
3. Opening it as `neil` shows the account; confirming links it
   (`claim_email`), and its events from before the link appear (the
   backfill).
4. Using the link again answers 410; a claim for an address no account
   has answers exactly as one that exists.
5. A sixth claim the same day is refused (429).
6. An `admin` releases `acct-other`; it is unowned again, its meetings
   are gone (its notes stay) and its events stop being stored.
7. With `acct-other` unowned, connecting it from the site (signing in to
   it) links it as `claim_consent`.

## C8 — The site

1. The Calendars pages match the chosen canvas (option A): accounts and
   their calendars, connect, re-authorize, claim, remove, a calendar's
   settings.
2. A `reauth_pending` account says so and re-authorizes from its row.
3. Removing an account removes its meetings from Minerva and keeps the
   notes that were linked to them.
4. A calendar's color, changed, survives a reload; another user does not
   see it.
5. A claim's link opens `/minerva/calendars/claim?token=…`, shows the
   account, and Confirm links it.

## C9 — Clean-up

1. Notes create and read with no `author`.
2. The console no longer offers account or calendar pages, and its old
   sign-in is closed.
