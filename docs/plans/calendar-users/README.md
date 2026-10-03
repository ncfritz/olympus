# Calendar users: phased implementation plan

The implementation of
[ADR 0028](../../decisions/0028-minerva-calendar-ownership.md): Minerva's
calendars and notes belong to users, calendar accounts are linked to a
user by sign-in, consent or claim, connecting moves from the sync agent's
console to the site, and the API consumes `calendar.events`. Each phase
ends in a working, deployable state and a functional sign-off against
[signoff.md](signoff.md).

| Phase | Delivers                                                                                            | Depends on | Sign-off flows |
| ----- | --------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| 0     | ADR accepted; prod checked for orphans; the branch                                                  | —          | —              |
| 1     | Minerva calendar and notes tables per user, existing rows Neil's; operations scoped to the caller   | 0          | C1             |
| 2     | The agent: subject per account, re-authorization checks it, unique `source`, the account on events  | 0          | C2             |
| 3     | The agent's service listener; the API's client certificate                                          | 2          | C3             |
| 4     | Calendar accounts in Olympus: linking by sign-in, connecting by web redirect, account and calendars | 1, 3       | C4, C5         |
| 5     | The API consumes `calendar.events`; backfill on link                                                | 4          | C6             |
| 6     | Claims: the email, the landing page, release                                                        | 4          | C7             |
| 7     | The site: the Calendars pages (canvas first)                                                        | 4, 5, 6    | C8             |
| 8     | Clean-up: `notes.author` dropped, the console's user pages and sign-in retired                      | 7          | C9             |
| Later | Ordering and version guard; attendees in the message; the console as an operations view; iOS        |            |                |

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

## Phase 1 — Minerva per user — built 2026-10-03, not signed off

1. **Migration** `<ts>_minerva_calendar_users`:
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
   - `meeting_notes`: foreign keys `(meeting_id, user_id)` to meetings
     and `(note_id, user_id)` to notes, both cascade.
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

**Sign-off:** C1 on DEV, then PROD after Neil applies the migration.

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

## Phase 3 — The API calls the agent

1. **Service listener**: the agent serves its management API on a second
   HTTPS port that requires a client certificate issued by Olympus
   Services and accepts only the CNs in its configuration
   (`MANAGEMENT_CLIENTS=olympus-api`), as the API's `3443` does (ADR 0018,
   0023). The code the API uses for `3443` moves to `packages/nest` if it
   is not already shared, rather than being copied. The existing listener
   keeps the console's sign-in until phase 8.
2. **Client certificate**: the API gets a client certificate
   (CN `olympus-api`, OU the deployment) from Olympus Services, issued by
   Neil, mounted as a secret (`~/Docker/secrets/olympus-api/`), and a
   `MinervaCalendarAgentClient` built on the shared API client (ADR
   0017), generated from the agent's OpenAPI document.
3. **Configuration**: `MINERVA_CALENDAR_AGENT_URL` and the certificate
   paths in the API's `*.env.example`; the compose files; the agent's
   listener port, published only on the Docker network.
4. **Tests**: the agent's e2e tests for a request with no certificate, a
   certificate from the wrong issuer, an unlisted CN; the API's client
   against a stub.

**Sign-off:** C3 on DEV, then PROD after Neil issues the certificate.

## Phase 4 — Calendar accounts in Olympus

1. **Migration** `<ts>_minerva_calendar_accounts`: `calendar_accounts`
   and `calendar_account_claims` as ADR 0028 has them (claims' table
   used in phase 6), and `meetings.account_id` (nullable, set null).
2. **Linking by sign-in**: after every sign-in, and when an account is
   first seen, the API links unowned accounts whose `(provider, subject)`
   is one of the user's identities (`verification_method = sign_in`).
   Accounts the agent has are mirrored into `calendar_accounts` (no
   owner) when the API first lists them, so a claim can find them.
3. **Connecting by web redirect**: the agent gains
   `StartCalendarAccountAuthorization` (returns the provider's URL for a
   given redirect URI, `state` and PKCE challenge) and
   `CompleteCalendarAccountAuthorization` (code, verifier, redirect URI →
   provider, subject, email), service-only. The API's operations:

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
   - The callback is the only route that is not `@RequiresIdentity()` by
     token: it finds the pending connection by `state`, which is bound to
     the user's session and single use, expires after ten minutes, and
     redirects back to the site with the result.
   - Connecting an account that is another user's sign-in identity, or
     already has another owner, is refused; the agent then drops the
     credential it just stored, unless the account was already there.
   - `UpdateCalendar` carries enabled, busy inclusion and color, each
     passed to the agent's existing operation.
   - `RemoveCalendarAccount` removes its calendars and credential at the
     agent and its meetings in Olympus, keeping notes.
   - Every operation is scoped to the caller's accounts; another user's
     account or calendar is a 404.

4. **Provider registration** (Neil): the redirect URI added to the
   Google OAuth client (as a web client) and the Microsoft app
   registration, for each environment's public host.
5. **Tests**: the API's operations against a stubbed agent (ownership,
   the refusals, `state` reuse and expiry); the linking rules as pure
   functions; the agent's two new operations.

**Sign-off:** C4, C5 on DEV.

## Phase 5 — The API consumes `calendar.events`

1. **Consumer**: an `@RabbitSubscribe` handler on queue
   `olympus-api.calendar-events`, bound to `event.*`, prefetch 20, with a
   dead-letter queue. It resolves the owner from `account`; unowned is
   acknowledged, not written, counted. `upsert` and `backfill` upsert the
   meeting by `id` with `user_id` and `account_id`; `delete` sets
   `deleted`. The message's fields map onto the existing columns through
   a pure converter.
2. **Backfill on link**: linking an account (any way) calls the agent's
   `BackfillCalendar` for each of its calendars.
3. **Metrics**: `calendar_events_consumed_total{action, result}`
   (`written`, `unowned`, `failed`).
4. **Tests**: the converter; the handler against Hasura in the API tests
   (owned, unowned, delete, a repeated message changes nothing).

**Sign-off:** C6 on DEV, then PROD.

## Phase 6 — Claims

1. **Operations**:

   | Operation                      | Route                                                         |
   | ------------------------------ | ------------------------------------------------------------- |
   | `CreateCalendarAccountClaim`   | `POST /minerva/calendar-account-claims`                       |
   | `DescribeCalendarAccountClaim` | `GET /minerva/calendar-account-claim/:token`                  |
   | `ConfirmCalendarAccountClaim`  | `POST /minerva/calendar-account-claim/:token/confirm`         |
   | `ReleaseCalendarAccount`       | `POST /minerva/calendar-account/:accountId/release` (`admin`) |
   - `CreateCalendarAccountClaim` takes the account's email and always
     answers 202 with the same body. An unowned account with that address
     gets a claim (the previous open one cancelled) and the email; five
     claims per user a day, then 429.
   - `DescribeCalendarAccountClaim` and `Confirm…` need the claimant
     signed in: another user gets 403 with the reason; an expired, used
     or cancelled token 410. Confirming links the account
     (`claim_email`) and starts the backfill.
   - An account whose address cannot receive mail is claimed by
     `ReauthorizeCalendarAccount` on an unowned account: the subject must
     match (`claim_consent`).

2. **The email**: a `minerva` context in the notification agent, the
   claim's template (who asked, which account, the link, when it
   expires, what to do if it was not them), sent over SMTP.
3. **Tests**: token hashing, expiry, single use, the same answer for an
   unknown address, the rate limit, the wrong user, release by `admin`
   only; the formatter's rendering.

**Sign-off:** C7 on DEV.

## Phase 7 — The site

1. **Canvas first**: the Calendars pages drawn and chosen before code:
   accounts with their calendars beneath, connect, re-authorize, claim,
   remove; a calendar's enable, busy inclusion and color; the claim
   landing page; how an unowned or `reauth_pending` account shows.
2. **Build** in the site's AntD components, a Calendars entry in the
   Minerva menu, the claim page at `/minerva/calendars/claim/[token]`.
3. **Tests**: the site's helper modules as unit tests, as the site does.

**Sign-off:** C8 on PROD.

## Phase 8 — Clean-up

1. `notes.author` dropped (migration), and from the model and the site.
2. The console's account and calendar pages removed; its OIDC sign-in and
   `AUTH_ALLOWED_EMAILS` retired, the old listener closed. What the
   console keeps, if anything, decided with Neil and recorded in ADR 0028.
3. The agent's README and ADR 0013's deferred list updated.

**Sign-off:** C9 on PROD.
