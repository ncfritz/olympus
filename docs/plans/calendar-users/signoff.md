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

1. Notes create and read with no `author`; an older client that still
   sends one creates its note all the same.
2. The console is unchanged: its pages and its sign-in work as before.

## C10 — Availability

Before the run, on the environment under test:

- The API knows where the console's agent is published:
  `AUTH_CONSOLE_BASE_URLS` (`http://localhost:4432` for the agent run from
  the workspace on DEV; set in `env/prod/olympus-api.env` on PROD).
- The agent knows where the API is: `OLYMPUS_API_URL` (DEV:
  `https://olympus.dev.ncfritz.net/api`; PROD: compose sets it), and its
  `AUTH_JWT_SECRET`, `AUTH_OIDC_PROVIDERS` and `AUTH_ALLOWED_EMAILS` are
  gone from its env file. On PROD the `minerva_auth_jwt_secret` and
  `minerva_oidc_providers` secret files can go once C10 passes.
- nginx reloaded, so the API's keys are at `/api/.well-known/jwks.json`.
- `neil` has the `admin` role in Olympus. The agent requires it itself,
  whatever `AUTH_MODE_USERS` says.
- The agent started once on this build: it drops its override tables.

1. The OnAir drawer looks and works as before, on Minerva: setting a
   meeting's status changes the shading for its time; choosing Clear puts
   the meeting's own back.
2. A block made by selecting a range wins over the meetings in it; moved,
   resized and removed, the shading follows.
3. The header's ON AIR button lights while the drawer's now is Do Not
   Disturb or Interruptable.
4. `user-b` sees none of `neil`'s availability, blocks or meeting
   statuses.
5. The console signs in through Olympus, with an Olympus session already
   open in one redirect, and is refused to `user-b`, who has no `admin`.
   It shows the same availability as the drawer, and a block or a
   meeting's status set in one shows in the other. An event of an account
   that is not `neil`'s has no status to set. Ten minutes on, the console
   still works (its token refreshed), and signing out of it ends its
   session in the site's session list.
6. The agent has no override tables or availability operations left.
