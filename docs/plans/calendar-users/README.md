# Calendar users: phased implementation plan

The implementation of
[ADR 0028](../../decisions/0028-minerva-calendar-ownership.md): Minerva's
calendars and notes belong to users, calendar accounts are linked to a
user by sign-in, consent or claim, connecting moves from the sync agent's
console to the site, and the API consumes `calendar.events`. Each phase
ends in a working, deployable state and a functional sign-off against
[signoff.md](signoff.md).

| Phase | Delivers                                                                                                       | Depends on | Sign-off flows |
| ----- | -------------------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| 0     | ADR accepted; prod checked for orphans; the branch                                                             | —          | —              |
| 1     | Minerva calendar and notes tables per user, existing rows Neil's; operations scoped to the caller              | 0          | C1             |
| 2     | The agent: subject per account, re-authorization checks it, unique `source`, the account on events             | 0          | C2             |
| 3     | The agent's service listener; the API's client certificate                                                     | 2          | C3             |
| 4     | Calendar accounts in Olympus: linking by sign-in, connecting by web redirect, account and calendars            | 1, 3       | C4, C5         |
| 5     | The API consumes `calendar.events`; backfill on link                                                           | 4          | C6             |
| 6     | Claims: the email, the landing page, release                                                                   | 4          | C7             |
| 7     | The site: the Calendars pages (canvas first)                                                                   | 4, 5, 6    | C8             |
| 8     | Clean-up: `notes.author` dropped, the docs brought up to date; the console kept as it is                       | 7          | C9             |
| 9     | Availability in Minerva: overrides per user, the OnAir drawer on Minerva, the console signs in through Olympus | 7          | C10            |
| Later | Ordering and version guard; attendees in the message; the console as an operations view; iOS                   |            |                |

Phases 1 and 2 are independent and can run in either order. Phase 6 can
run beside phase 5.

## Where the code goes

| What             | Where                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema           | `infra/hasura/migrations/olympus/<ts>_minerva_calendar_*`, with metadata (custom camelCase column names); tests in `infra/hasura/tests/minerva_calendar_*.sql`                         |
| Message contract | `packages/messages/src/calendarEvents.ts` and `schemas/calendar-event.schema.json`                                                                                                     |
| Model shapes     | `packages/model/src/minerva/calendars/`: `accounts.ts`, `calendars.ts`, `claims.ts`, `index.ts`                                                                                        |
| API              | `apps/api/src/minerva/calendars/`: `CalendarsModule`, `controllers/`, `services/`, `converters/`, `queries/`, `consumer/` (the `calendar.events` handler), `agent/` (the agent client) |
| Existing API     | `apps/api/src/minerva/meetings/` and `minerva/notes/`: identity and scoping                                                                                                            |
| Agent            | `agents/minerva-calendar-sync/agent/src/`: `calendarAuth/`, `providers/`, `store/`, `outbox/`, a service listener beside `main.ts`                                                     |
| Notification     | `agents/olympus-notification/src/delivery/contexts/minerva.ts` and the claim email's template                                                                                          |
| Site             | `apps/site/src/pages/minerva/calendars/`, `src/components/minerva/calendars/`, `src/api/calendarsApi.ts`; the claim landing page `pages/minerva/calendars/claim/[token].tsx`           |

Operations follow `docs/conventions/api.md` and start from
`pnpm gen api-operation`. Every new table has the audit columns
(`created_at`, `updated_at`, the `set_minerva_<table>_updated_at`
trigger, the custom names `createdTime` and `lastUpdatedTime`), and each
migration test checks that an update moves `updated_at` and leaves
`created_at`.

## Phase 0 — Decision and checks

1. **ADR 0028 accepted**: **done** 2026-10-03 (Neil).
2. **Branch** `feature/calendar-users` off `main`: **done**.
3. **Orphans in prod**, read-only, run by Neil before phase 1's
   migration is applied: `meeting_attendees` and `meeting_notes` rows
   whose meeting is missing; `meeting_notes` rows whose note is missing;
   notes whose parent is missing; the distinct `meetings.source` values
   and their counts. Phase 1's foreign keys accept none of the first
   four, so the migration checks for them itself and raises, naming the
   counts, rather than deleting anything; what is found is decided with
   Neil.

   ```sql
   select 'attendees without meeting', count(*) from minerva.meeting_attendees a
    where not exists (select 1 from minerva.meetings m where m.id = a.meeting_id)
   union all
   select 'meeting_notes without meeting', count(*) from minerva.meeting_notes mn
    where not exists (select 1 from minerva.meetings m where m.id = mn.meeting_id)
   union all
   select 'meeting_notes without note', count(*) from minerva.meeting_notes mn
    where not exists (select 1 from minerva.notes n where n.id = mn.note_id)
   union all
   select 'notes without parent', count(*) from minerva.notes n
    where n.parent_id is not null
      and not exists (select 1 from minerva.notes p where p.id = n.parent_id)
   union all
   select 'source ' || source, count(*) from minerva.meetings group by source;
   ```

   **Run 2026-10-03 (Neil):** 6,260 attendees without their meeting, none
   of the other three; sources `amzn` (5,363) and `unknown` (71). Decided:
   the migration clears out every meeting and attendee of the old sync
   and touches no note, meeting link or note association. The raw records
   are archived; a one-time import of the historic meetings, under their
   same IDs, comes later and finds their notes again.

## Phase 1 — Minerva per user — built 2026-10-03, not signed off

1. **Migration** `<ts>_minerva_calendar_users`:
   - Clears out every meeting and attendee (phase 0's decision), saying
     how many; keeps notes, meeting links, note associations and the
     people met (`meeting_user`).
   - Finds the user with `lower(email) = 'ncfritz@ncfritz.net'`. If any
     of the six tables has rows and there is no such user, it raises and
     changes nothing.
   - Adds `user_id uuid` to `meetings`, `meeting_attendees`,
     `meeting_notes`, `meeting_user`, `notes` and `note_associations`,
     fills it with that user, then makes it `not null`, references
     `olympus.users` (cascade).
   - `meetings`: unique `(id, user_id)`; index `(user_id, start_time)`;
     `created_at` and `updated_at` (existing rows get the migration's
     time), the trigger.
   - `notes`: unique `(id, user_id)`; index `(user_id, created_at)`.
   - `meeting_notes`: a foreign key `(note_id, user_id)` to notes,
     cascade, and none to meetings: a link outlives its meeting.
   - `note_associations`: `(note_id, user_id)` to notes, replacing the
     single-column key; `updated_at` and the trigger.
   - `meeting_attendees`: `(meeting_id, user_id)` to meetings, cascade;
     the audit columns.
   - `meeting_user`: primary key `(user_id, email)`; the audit columns.
   - The five statistics functions are dropped and created again with a
     `user_id uuid` first argument; the metadata follows.
   - `down.sql` reverses it, and refuses when a second user owns rows.
2. **Operations**: every meetings and notes operation
   `@RequiresIdentity()`, `requireUser(principal)`, the user's ID passed
   to the service, every query and insert scoped by it. Another user's
   meeting or note is a 404. Change sets lose `id`, `user_id`, `userId`
   and `account_id` before they reach Hasura (they arrive as Hasura
   column names, unchecked). `CreateCalendarItem` answers 409 for an ID
   that is another user's meeting, and writes the people, the meeting
   and its attendees as three inserts in one mutation instead of nested
   ones, since the people are now keyed by user. A child note's parent
   must be the caller's (404 otherwise). `CreateNote` keeps writing the
   `author` the site sends until phase 8 drops the column; nothing
   filters on it any more. `CreateReviewPin` only pins the caller's own
   notes.
3. **Callers**: the site's meetings and notes calls go through the
   Minerva SDK client, which already carries the user's token
   (`auth/interceptors.ts`); nothing else calls these operations.
4. **Tests**: `test/api/minerva/calendar.spec.ts` and `notes.spec.ts`
   cover no identity (401, Hasura not asked), scoping, another user's
   rows, protected columns and the 409; their Location headers moved
   there from `locations.spec.ts`, which has no signed-in caller.
   `infra/hasura/tests/minerva_calendar_users.sql` covers the composite
   keys, the cascades, the statistics per user and audit times;
   `minerva_review_pins.sql` now gives each user a note of their own.
   The backfill was checked by applying the migration to databases
   seeded before it: rows and no user (refused), orphans (refused, with
   counts), clean (every row Neil's), and `down.sql` and `up.sql` twice,
   `down.sql` refusing once a second user owns rows. Verified
   2026-10-03 against PostgreSQL 16 with every migration applied; the
   API's build, lint, typecheck, tests (2,095) and convention checks
   pass, and the site's tests pass.

**Sign-off:** C1 on DEV: clean (Neil, 2026-10-03; the migration and
metadata applied to `hasura-dev`, 159 note associations kept). PROD
after Neil applies the migration.

## Phase 2 — The agent knows accounts by subject — built 2026-10-03, not signed off

1. **Re-authorization checks the account**: **done**, its own commit with
   tests that fail before it. Every sign-in from the agent, new or
   re-authorization, now asks for the account's identity (Google adds
   `openid`; Microsoft `openid`, `email` and `profile`), and
   `confirmSameAccount` refuses a re-authorization, keeping the stored
   credential, unless the same account signed in: by subject once one is
   stored, until then by verified email (the label was taken from it).
   Google's identity comes from the access token's token info; Microsoft's
   subject is `<tid>:<oid>` from the ID token.
2. **Stored credentials carry `subject`**: **done**. Recorded at every
   sign-in; `AccountSubjectBackfillService` reads it once after start-up
   for credentials stored before (Google: token info of a fresh access
   token; Microsoft: the refreshed ID token), in the background. An
   account with a working credential but no subject reports `expired`
   ("The account's identity is not recorded; sign in again") instead of
   `reauth_pending`, which means a sign-in in progress. `CalendarAccount`
   in the management API gains `subject`.
3. **`source` is unique**: **done** — a unique index on
   `SyncedCalendar.source` in both stores (migration
   `20261003190000_unique_synced_calendar_source`) and a 409 from
   `CreateCalendar`. `SYNCED_CALENDARS` is no longer read (calendars are
   all in the store), so there is no start-up check. If two calendars
   already share a source, the migration fails on start-up: rename one in
   the store first.
4. **Messages name the account**: **done** —
   `CalendarEventMessage.account` (`provider`, `subject`), optional, in
   `@ncfritz/olympus-messages` and its JSON Schema. The dispatcher adds it
   when it sends a row (`EventAccountResolver`: the source's calendar, its
   account's stored subject) rather than when the row is written, so rows
   queued before this change carry it too; a calendar's account never
   changes, so the answer is the same. With no subject or no calendar the
   message goes without `account`, and the API (phase 5) treats it as
   unowned.
5. **Tests**: **done** — `confirmSameAccount`; re-authorization refusals
   for Google (another email, an unverified one, another subject) and
   Microsoft; the subject recorded at sign-in and by the backfill; the
   status without a subject; the duplicate source in the service and over
   HTTP; the dispatcher and resolver. Verified 2026-10-03: the agent's
   tests (755), typecheck, lint and convention checks, and the messages
   package's tests, pass.

**Sign-off:** C2 on DEV.

## Phase 3 — The API calls the agent — built 2026-10-03, not signed off

1. **Shared listener**: **done**, as its own behaviour-preserving commit —
   the API's services listener, its revocation-list check and the reading
   of a client certificate's service and issuer moved to
   `@ncfritz/olympus-nest` (`createClientCertificateListener`,
   `identifyPeerCertificate`, `revocationCoverage`).
2. **Agent's services listener**: **done** — with the API's variable names
   (`SERVICES_LISTEN_PORT`, default 4433; `TLS_CERT`, `TLS_KEY`,
   `TLS_CA_SERVICES`, `TLS_CRL_SERVICES`, `AUTH_SERVICES_ISSUER`) and
   `AUTH_SERVICE_CLIENTS` (default `olympus-api`); off until the first three
   are set. `JwtAuthGuard` takes the caller from the certificate there and
   from the token on the HTTP listener, never the other way round; a
   service has no signed-in user (`DescribeCurrentUser` refuses it). The
   console's listener and sign-in are unchanged until phase 8.
3. **API's client**: **done** — `MinervaCalendarAgentClient` in the new
   `minerva/calendars` feature, axios with a keep-alive HTTPS agent
   presenting the API's certificate and `X-Olympus-Client: olympus-api`;
   503 when unconfigured, 502 when the agent fails or cannot be reached.
   Hand-written rather than generated: the SDK is generated from the API's
   own documents and depends on the API, so the API cannot depend on it.
   Its one operation so far is `ListCalendarAccounts`; phase 4 adds what it
   needs.
4. **Configuration**: **done** — `MINERVA_CALENDAR_AGENT_URL`,
   `_CLIENT_CERT`, `_CLIENT_KEY`, `_CA_CERT` and `_TIMEOUT_MS` for the API;
   the env examples; in prod, commented blocks in both env files and the
   agent's `/run/secrets/tls` mount, reached only over the backend network.
   `scripts/dev-ca.sh` mints `minerva-calendar-sync.crt` (the agent's
   server certificate, from the service issuer) and `agents/olympus-api.*`
   (the API's client certificate); an existing dev CA needs `--force`.
5. **Tests**: **done** — the agent over real mTLS with the dev CA (the
   API's certificate in, another service's 403, the device issuer, no
   certificate and a revoked one refused in the handshake), the guard,
   both configurations, and the API's client against a stand-in listener
   (its certificate and header, 502, 503). Verified 2026-10-03: the API's
   tests (2,091), the agent's (778) and the nest package's pass, with
   typecheck, lint and convention checks.

**Sign-off:** C3 on DEV, then PROD after Neil issues the certificate.

## Phase 4 — Calendar accounts in Olympus — built 2026-10-03, not signed off

1. **Migration**: **done** — `1791110000000_minerva_calendar_accounts`:
   `calendar_accounts` (an owner, its proof and the time of it are set
   together or not at all), `calendar_account_connections` (the sign-ins
   in flight, see 3) and `calendar_account_claims` (used in phase 6), and
   `meetings.account_id` (nullable, set null).
2. **Linking by sign-in**: **done**, with one change — `ListCalendarAccounts`
   records the accounts the agent holds (no owner) and then links the
   unowned ones whose `(provider, subject)` is one of the caller's
   identities (`verification_method = sign_in`). It is done there rather
   than after every sign-in, so signing in to Olympus does not depend on
   the agent being up; the site lists accounts before showing any.
3. **Connecting by web redirect**: **done**.
   - The agent's side shipped in `ee6b8247`, named
     `StartCalendarAccountWebSignIn`, `CompleteCalendarAccountWebSignIn`
     and `DeleteCalendarAccount`, `@ServicesOnly()`. Its web sign-ins use
     separate web clients (Google `GOOGLE_WEB_OAUTH_CLIENT_ID/SECRET`,
     Microsoft `MICROSOFT_OAUTH_CLIENT_SECRET` on the same registration);
     each credential records the client that issued it.
   - The API's operations, all in `minerva/calendars`:

   | Operation                        | Route                                                   |
   | -------------------------------- | ------------------------------------------------------- |
   | `ListCalendarAccounts`           | `GET /minerva/calendar-accounts`                        |
   | `ConnectCalendarAccount`         | `POST /minerva/calendar-accounts/connect`               |
   | `CompleteCalendarAccountConnect` | `GET /minerva/calendar-accounts/callback/:provider`     |
   | `ReauthorizeCalendarAccount`     | `POST /minerva/calendar-account/:accountId/reauthorize` |
   | `DescribeCalendarAccount`        | `GET /minerva/calendar-account/:accountId`              |
   | `RemoveCalendarAccount`          | `DELETE /minerva/calendar-account/:accountId`           |
   | `ListAvailableCalendars`         | `GET /minerva/calendar-account/:accountId/available`    |
   | `ListCalendars`                  | `GET /minerva/calendars`                                |
   | `AddCalendar`                    | `POST /minerva/calendar-account/:accountId/calendars`   |
   | `UpdateCalendar`                 | `PUT /minerva/calendar/:calendarId`                     |
   | `RemoveCalendar`                 | `DELETE /minerva/calendar/:calendarId`                  |
   - A started sign-in is a row in `calendar_account_connections`: the
     user, the state's SHA-256 (the state itself goes only to the
     provider), the PKCE verifier, the page to return to (an origin in
     `AUTH_CLIENT_ORIGINS`) and a ten-minute expiry. The callback takes the
     row by marking it completed, so a replay finds nothing and is a 400.
     The state is bound to the user, not to the browser session.
   - The callback is the only route without `@RequiresIdentity()`; it
     always redirects to the stored page with `calendarAccount=connected`
     (and `accountId`), `cancelled`, `expired`, `refused` (`reason=owned`
     or `another-account`) or `failed`. It is allow-listed for the
     standard-errors and success-response conventions, as the API's own
     sign-in callback is.
   - Connecting an account that is another user's, or another user's
     sign-in identity, is refused; the agent's new credential is deleted,
     unless the agent already held it.
   - `UpdateCalendar` carries `enabled` and `includedInBusy`. Colors are
     the console's per-viewer setting, not the agent's; they come with
     the site in phase 7.
   - `RemoveCalendarAccount` deletes the account at the agent (its
     calendars and credential), then its meetings and the account in
     Minerva. Notes, their meeting links and associations stay. An
     account the agent no longer holds is removed all the same; an agent
     failure keeps it.
   - Every operation is scoped to the caller's accounts; another user's
     account or calendar is a 404. The agent's 400, 404 and 409 pass
     through; it being down is a 502 (`ListCalendarAccounts` still
     answers, each account's status `unknown`).
   - `AUTH_PUBLIC_BASE_URL` must be set: the callback is
     `<it>/v1/minerva/calendar-accounts/callback/<provider>`, and without
     it a sign-in is a 503.

4. **Provider registration** (Neil): a Google OAuth **web** client and a
   client secret on the Microsoft app registration, each with the redirect
   URI above for each environment's public host.
5. **Tests**: **done** — the sign-in helpers and linking rules as pure
   functions; every operation over HTTP against a stubbed agent: no
   identity, ownership, the refusals, cancel, expiry, replay, another
   provider's callback, a missing subject, removal with and without the
   agent. The tests found the new module had not imported the GraphQL
   client, which typecheck could not. Verified 2026-10-03: the API's
   tests (2,171) and the model's pass, with typecheck, lint and the
   convention checks.

**Sign-off:** C4, C5 on DEV.

## Phase 5 — The API consumes `calendar.events` — built 2026-10-03, not signed off

1. **Consumer**: **done** — `CalendarEventHandler` in `minerva/calendars`,
   the API's first RabbitMQ consumer.
   - Queue `olympus-api.calendar-events` (durable), bound to `event.*` on
     `calendar.events`, on its own channel with prefetch 20. Rejected
     messages go through the default exchange to
     `olympus-api.calendar-events.dead`, which the API declares. The API
     also declares the exchange, so the queue binds before the agent has
     started.
   - The owner comes from `account`: the `calendar_accounts` row with that
     `(provider, subject)` and a user. No account, or no owner: acknowledged
     and not written.
   - `upsert`, `backfill` and `delete` all upsert the event's snapshot by
     `id` (`meetings_pkey`), rewriting every column it sets, `user_id` and
     `account_id` included. A delete's snapshot has `deleted: true`, so a
     delete is the same write. A repeated message writes the same values.
   - The converter (`CalendarEventConverter`) maps the message onto the
     table's existing vocabulary, which is Outlook's and what the site
     shows: `Busy`, `OOF`, `RecurringMaster`, and so on. `response` becomes
     `Organizer`, `Accepted`, `Declined`, `Tentative` or `NotResponded`, and
     `type` becomes `Appointment`, `Meeting` or `Other`. **The import
     script for the archived meetings must use the same values**; check
     the archive's values against these when writing it.
   - What can never be written is dead-lettered: an unknown routing key, a
     malformed event (checked field by field), or a write Hasura refuses
     for its data (a constraint, a bad value). Anything else Hasura does
     (no answer, Postgres down) puts the message back after a wait of 5 s,
     doubling to at most a minute, so an outage holds the queue rather
     than emptying it into the dead letters.
2. **Backfill on link**: **done** — after a web sign-in links a new
   account, and after `ListCalendarAccounts` links sign-in identities (it
   reads back which ones), the API asks the agent to `BackfillCalendar`
   each of that account's calendars. A re-authorization of an account
   already the user's, and a refused link, backfill nothing. It is best
   effort: an agent failure is logged and the link stands. Phase 6's claims
   use the same path.
3. **Metrics**: **done** — `calendar_events_consumed_total{action, result}`
   with `written`, `unowned`, `invalid` (dead-lettered) and `failed`
   (requeued). `invalid` is new beside the plan's three.
4. **Tests**: **done** — the converter, field by field, and the routing
   key; the handler as RabbitMQ calls it, against the API's Hasura
   stand-in: owned, backfill, delete, a repeated message, unowned, no
   account, malformed, unknown key, refused by Hasura, requeued with the
   growing wait; the binding's options; backfill on both kinds of link and
   when it fails. The test app and the OpenAPI generator stub
   `createSubscriber`, as they already stub the connection. Verified
   2026-10-03: the API's tests (2,221), typecheck, lint and the convention
   checks.

**Sign-off:** C6 on DEV, then PROD.

## Phase 6 — Claims — built 2026-10-03, not signed off

1. **Operations**: **done**, in `minerva/calendars`
   (`CalendarAccountClaimService`):

   | Operation                      | Route                                                         |
   | ------------------------------ | ------------------------------------------------------------- |
   | `CreateCalendarAccountClaim`   | `POST /minerva/calendar-account-claims`                       |
   | `DescribeCalendarAccountClaim` | `GET /minerva/calendar-account-claim/:token`                  |
   | `ConfirmCalendarAccountClaim`  | `POST /minerva/calendar-account-claim/:token/confirm`         |
   | `ReleaseCalendarAccount`       | `POST /minerva/calendar-account/:accountId/release` (`admin`) |
   - `CreateCalendarAccountClaim` takes `email` and `confirmPage` (a page of
     one of `AUTH_CLIENT_ORIGINS`, as `returnTo` is for connecting) and
     always answers 202 with the address it was given. Each unowned account
     with that address, matched in any case, gets a claim and an email,
     unless another user signs in to Olympus with it. Opening a claim
     cancels the account's previous open one in the same request. The link
     is `confirmPage?token=<token>`; the token is 32 random bytes, stored
     only as its SHA-256, and works for 24 hours.
   - **The limit**: five claims per user a day, then 429. It counts every
     claim, whether or not an account matched; counting only matches would
     tell a user which addresses exist. It is held in memory, like the
     sign-in limits (`RateLimiter`, keyed by user), so an API restart
     forgets it; `AUTH_RATE_LIMITS=off` turns it off.
   - `DescribeCalendarAccountClaim` changes nothing. Both it and
     `Confirm…` answer 404 for an unknown token; 403 for another user, with
     the reason; 410 once expired, confirmed or cancelled; and 409 when the
     account has an owner since. Confirming first takes the claim (only if
     still open and unexpired; otherwise 410), then links the account
     where it is still unowned (`claim_email`; otherwise 409), then
     backfills it.
   - **No-mail accounts, changed from the plan**: an account that cannot
     receive mail is claimed by connecting it (`ConnectCalendarAccount`),
     not by `ReauthorizeCalendarAccount`. Re-authorizing needs the account's
     ID, which a user who does not own it never sees. Signing in to an
     account the agent already holds unowned proves it by the subject, and
     is recorded as `claim_consent`.
   - **Release**, decided here: makes the account unowned, deletes its
     meetings in Minerva (as removing it does; notes, meeting links and
     associations stay) and cancels its open claims. The agent keeps the
     credential, so the account can be claimed again; until then its
     events are `unowned`. The `admin` role is checked only where the
     users listener enforces (`AUTH_MODE_USERS=enforce`), as for every
     other `admin` operation; prod still reports.

2. **The email**: **done** — `minerva_calendar_account_claim`, published
   by the API straight onto the notification agent's `email` channel
   (Gmail), not through `SendNotification`, with the claim's ID as its
   notification ID and its expiry as the message's.
   - Its context is part of the message contract
     (`CalendarAccountClaimContext` in `@ncfritz/olympus-messages`).
   - The agent's `CalendarAccountClaimEmailFormatter` renders who asked,
     the provider and account, the link, the expiry (in UTC, said so) and
     what to do if it was not them. The HTML escapes every value; the
     plain-text part does not, so the link survives (the test caught an
     escaped `=` there).
   - The From is `MINERVA_CLAIM_MAIL_FROM` on the API; unset, claims answer 503. In the env examples and commented in prod.
3. **Tests**: **done** — the token, link, state, address and `_ilike`
   escaping as pure functions; every operation over HTTP: the mail and its
   contents, the same answer for an unknown address, another user's sign-in
   identity, a broker failure, the sixth claim (for one user only), bad
   input; describe changing nothing, the 403, 404, 409 and each 410; the
   confirm races; release by `admin` only; the `claim_consent` sign-in; the
   email's rendering and escaping. Verified 2026-10-03: the API's tests
   (2,267), the notification agent's and the packages', with typecheck,
   lint and the convention checks.

**Sign-off:** C7 on DEV.

## Phase 7 — The site — built 2026-10-03, not signed off

1. **Canvas first**: **done** — "Minerva Calendars" on claude.ai: two
   layouts for the page, the add-calendars drawer, the claim dialog, the
   claim landing page, every account state and sign-in outcome, and the
   remove dialog. Neil chose (2026-10-03):
   - **Option A**: each account a card with its calendars in a table
     beneath it (not a list with a detail pane).
   - **Colors kept**: a color per calendar, the user's own.
   - **Calendars under Meetings** in the Minerva menu.
   - **The claim page takes `?token=`**: `/minerva/calendars/claim?token=…`,
     the `confirmPage` the API was built with, not `/claim/[token]`.
2. **Colors**: **done**, added for this phase.
   - Migration `1791120000000_minerva_calendar_colors`:
     `minerva.calendar_colors`, keyed by user and source label (unique at
     the agent, and how meetings name their calendar), `#rrggbb` in lower
     case, audit columns, cascading with the user. Its check script is
     `infra/hasura/tests/minerva_calendar_colors.sql`; metadata
     `minerva_calendar_colors.yaml`.
   - `ListCalendars` returns each calendar's `color` once the user has
     chosen one; `UpdateCalendar` takes `color` and keeps it in Minerva,
     asking the agent only for `enabled` and `includedInBusy`.
   - Without a choice the site picks one of eight colors from the label,
     so it stays put as calendars come and go. Removing a calendar or an
     account leaves its color, which comes back with the label.
3. **Build**: **done** — `pages/minerva/calendars/index.tsx` and
   `claim.tsx`, `components/minerva/calendars/` (`AccountCard`,
   `AddCalendarsDrawer`, `ClaimModal`, `CalendarsBreadcrumbs`),
   `api/calendarsApi.ts`, `utils/calendars.ts`, and a Calendars entry under
   Meetings in the Minerva menu.
   - Connecting and re-authorizing send the browser to the provider and
     back to the page, which shows the outcome once and clears it from the
     address. A connected account offers its calendars straight away.
   - Switches and colors change at once and go back if the API refuses.
   - When the agent cannot be asked (every account `unknown`), the page
     says so and changes nothing.
   - Add calendars suggests a label from each calendar's name and checks
     it against the user's own labels; the API's 409 for another user's
     shows on that calendar.
   - The claim page shows the claim and changes nothing until Confirm;
     403, 404, 409 and 410 each say what they mean.
4. **Tests**: **done** — the page's helpers (`test/unit/calendars.spec.ts`:
   states, outcomes, colors, labels, last synced, claims); the colors in
   the API's calendars spec and the migration's check script. Verified
   2026-10-03: the site's tests (286), lint and a production build; the
   API's tests (2,275), typecheck, lint and the convention checks. The
   site's typecheck fails only on `test/unit/triage.spec.ts`, as on
   `main`.

**Sign-off:** C8 on PROD (apply `1791120000000_minerva_calendar_colors`
and its metadata first).

## Phase 8 — Clean-up — built 2026-10-03, not signed off

1. **`notes.author`**: **done** — migration
   `1791130000000_minerva_notes_drop_author` drops the column (its
   `down.sql` brings it back filled with each owner's email). Gone from the
   model (`BaseNote`, so from creating and reading a note), the API's
   query, converter and create mutation, and the site's note forms. The API
   does not refuse unknown fields, so an older client that still sends
   `author` is ignored, not refused (tested). The database check scripts
   for calendar users and review pins no longer insert it.
2. **The console, changed from the plan (Neil, 2026-10-03)**: it stays as
   it is, its pages, OIDC sign-in and `AUTH_ALLOWED_EMAILS` included, as an
   operator's view. Availability overrides, which only the console offers,
   move into the site as phase 9. Recorded in ADR 0028.
3. **Docs**: **done** — ADR 0013's deferred list marks what ADR 0028
   settled (ordering and version guards stay deferred); ADR 0028 amended
   for the console; the agent's README says who manages accounts now and
   what the services listener serves. Verified 2026-10-03: the API's tests
   (2,276), the model's and the site's, with typecheck, lint and the
   convention checks; the migration up, down and up again with the check
   scripts.

**Sign-off:** C9 on PROD.

## Phase 9 — Availability in Minerva (ADR 0029, proposed)

Decided with Neil (2026-10-04): overrides move to Minerva, per user; the
agent's are deleted; they are set from a meeting on the calendar pages and
in the OnAir drawer, which moves from the legacy OnAir service to Minerva;
the console signs in through Olympus and sees the same availability.

1. **Canvas first**: the OnAir drawer on Minerva (the day, its meetings,
   the availability strip, a new block, a meeting's availability), the
   availability control on the day view's meeting details, and the
   console's sign-in through Olympus.
2. **Schema**: `minerva.availability_blocks` and
   `minerva.meeting_availability`, per user, audit columns, check scripts.
3. **API**: the availability rules as pure functions, ported from the
   agent with its tests; `GetAvailability`, the block operations,
   `SetMeetingAvailability` and `ClearMeetingAvailability`.
4. **Site**: the OnAir drawer rebuilt on the API (the legacy `onairApi`
   goes); the meeting details' availability control.
5. **Console and agent**: a `minerva-calendar-console` client in the API's
   sign-in; the agent verifies Olympus tokens (JWKS, `admin`); the
   console signs in through Olympus and calls the API for availability;
   the agent's override and availability operations, tables and rows go,
   with its OIDC sign-in and allow-list.
6. **Tests**: the rules (precedence, blocks over meetings, working day,
   time zones, excluded calendars, cancelled and deleted); every operation
   scoped to its caller; the drawer's helpers; the agent's token check.

**Sign-off:** C10 on DEV, then PROD.
