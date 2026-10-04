# 0028. Minerva calendars per user; accounts linked by sign-in, consent or claim

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

[ADR 0013](0013-minerva-calendar-sync-integration.md) has the calendar
sync agent (`agents/minerva-calendar-sync`) publish every event change to
`calendar.events`, and the `minerva_*` tables in Hasura kept in sync from
those messages. It deferred the schema for many calendars, where the
consumer runs, and delete handling. None of that is built: the API
publishes to RabbitMQ but consumes nothing, and `minerva.meetings` still
holds what an older single-calendar sync wrote (`source` defaults to
`AMZN`).

Olympus now has users ([ADR 0018](0018-authentication.md)), and every
newer Minerva table (tags, goals, reviews) carries `user_id`. The
calendar and notes tables do not:

- `minerva.meetings`, `meeting_attendees`, `meeting_notes`,
  `meeting_user`, `notes` and `note_associations` have no owner. `notes`
  has `author text`, which the site fills with the literal `"ncfritz"`.
  `meetings`, `meeting_attendees` and `meeting_user` have no audit
  columns, and nothing has a foreign key to `meetings`.
- The meetings and notes operations have no `@RequiresIdentity()` and
  read and write every row. The `meeting_*_statistics` and
  `notes_*_statistics` functions count every row.

The sync agent knows nothing of users:

- A connected account is a stored refresh token, one file per account,
  named by its email (`accountLabel`). The provider's subject (the
  account's permanent ID) is not recorded.
- A synced calendar is `(provider, accountLabel, calendarId, source)`,
  declared in `SYNCED_CALENDARS` or added at runtime. `source` labels the
  calendar's events, and `<source>:<uid>` is the event's ID; nothing
  makes `source` unique.
- `CalendarEventMessage` names the `source` only, not the account.
- Accounts are connected from the agent's console with a loopback
  redirect (`127.0.0.1`, RFC 8252), which only completes when the browser
  runs on the agent's machine, and does not check `state`.
- Re-authorizing an account saves whatever refresh token comes back under
  the old label, without checking that the same account signed in.
  Choosing another account at the consent screen silently moves the
  label, and its calendars, to that account.
- The console signs in with its own OIDC providers and an
  `AUTH_ALLOWED_EMAILS` list.

What has to be decided: who owns a calendar, how Olympus knows a user
really controls an account they say is theirs, and how the existing rows
get an owner. Neil is the only user today, and owns all of them.

## Decision

### Ownership: user → account → calendar → event

- A **calendar account** is one provider sign-in: the stored credential.
  It is identified by `(provider, subject)`: Google's `sub`; Microsoft's
  tenant and object IDs, `<tid>:<oid>` (Microsoft's `sub` differs per
  application, so it would not match across apps). The email is a label,
  recorded when the account was connected, and never the key: addresses
  change, and an account can be reached through an alias.
- An account has **one owner**, a row in `olympus.users`. Its calendars,
  and their events, belong to that owner. Two users who both sync a
  shared calendar each sync it through their own account and each get
  their own copy.
- The agent stays unaware of users. Olympus records ownership; the agent
  records which account each calendar authorizes with.

### Verification

An account is linked to a user in one of three ways, and only these.
Every way proves the user controls the account at the provider, not that
they know its address.

1. **Sign-in identity.** An account whose `(provider, subject)` equals one
   of a user's `olympus.user_identities` is that user's, verified at
   once. It is the account they sign in to Olympus with. Such an account
   can be connected only by that user; another user connecting it is
   refused.
2. **Consent from Olympus.** A signed-in user connects an account from the
   site. Completing the provider's consent screen, in a flow the API
   started for that user and checks the `state` of, is the proof. The
   account is linked to them when the flow completes.
3. **Claim.** For an account already connected without an owner (before
   this decision, or from the agent's command-line scripts), a user
   claims it. Olympus emails a link to the address the agent recorded for
   the account. The link opens Olympus; when the user signed in there is
   the user who made the claim, and they confirm, the account is linked.
   - The claimant names the account by its email; that only finds it.
     The mail goes to the recorded address, and the answer is the same
     whether or not an unowned account has that address, so a claim
     cannot be used to discover which accounts exist.
   - The link carries a random token, single use, valid for 24 hours;
     only its hash is stored, with the claim and the claimant.
   - Opening the link changes nothing: a mail scanner may open it. The
     page shows the account and asks the claimant to confirm. A
     different signed-in user is refused, and told why.
   - An account has at most one open claim; a new one cancels the
     previous. Claims are limited per user (five a day).
   - An account with an owner cannot be claimed. Releasing it is an
     `admin` operation.
   - When the address cannot receive mail (an account with no mailbox),
     re-authorizing from Olympus (way 2) is the claim instead: the
     subject that comes back must be the stored one.

The verification method and time are recorded with the link.

### Connecting moves into the site

Everything a user does with calendars moves from the agent's console to
the Olympus site: connecting and re-authorizing accounts, claiming them,
adding, pausing and removing calendars, busy inclusion and colors. Each
user sees and changes only their own accounts and calendars.

- **A web redirect replaces the loopback.** The redirect URI is the API's
  (`/v1/minerva/calendar-accounts/callback/:provider` on the public host),
  registered with Google and Microsoft as a web client. The API starts the
  flow (`state` bound to the user's session, PKCE), receives the
  callback, checks `state`, and hands the code and verifier to the agent,
  which exchanges them, keeps the refresh token and returns the account's
  provider, subject and verified email. Tokens and the OAuth client
  secrets stay in the agent; the API never sees them.
- **Re-authorization checks the subject.** A new consent for an existing
  account must return the stored subject, or it is refused and the
  stored credential is kept. This is fixed in the agent whatever path
  started the flow.
- The loopback flow remains only for the agent's command-line setup
  scripts.
- **`source` is unique**, enforced by the agent, since it names the
  calendar's events. The site proposes one from the calendar's name.

### The Olympus API is the agent's only management client

- The agent's management API gains a listener that requires a service
  certificate (ADR 0018, checked by issuer per
  [ADR 0023](0023-service-certificates-are-checked-by-issuer.md)), and
  the Olympus API calls it with its own client certificate
  (`olympus-api`). Users never reach the agent; the API checks ownership
  and then calls it.
- The console's OIDC sign-in and `AUTH_ALLOWED_EMAILS` were to be retired
  once the site covered what users do. **Amended (Neil, 2026-10-03):** the
  console stays as it is, its sign-in and pages included, as an operator's
  view (events and availability, sync runs, the outbox). Availability
  overrides, which only the console offers, move into the site in a phase
  of their own; until then the console is where they are set.

### The message names the account

`CalendarEventMessage` gains `account: { provider, subject }`. The agent
records the subject of every account; for accounts connected before this
change it reads it from a fresh access token (Google's token info,
Microsoft's token claims) and marks an account it cannot read as needing
re-authorization.

### The API consumes `calendar.events`

This settles ADR 0013's deferred consumer: the API subscribes, since it is
the only Hasura client (queue `olympus-api.calendar-events`).

- A message resolves its owner from `account`. An account with no
  verified owner is acknowledged and not written, and counted
  (`calendar_events_consumed_total{result="unowned"}`).
- `upsert` and `backfill` upsert the meeting by `id`, owner and account
  set from the account; `delete` marks it deleted. Overwriting edits made
  in Olympus stays as ADR 0013 says.
- When an account is linked, the API asks the agent to backfill each of
  its calendars, which publishes their events again. That is how events
  from before the link arrive; the consumer needs no other path.
- ~~Ordering and version guards stay deferred, as in ADR 0013.~~
  **Amended (Neil, 2026-10-04):** a message carries `snapshotTime`, when
  the agent took the snapshot, and the meeting keeps it
  (`snapshot_time`). A write whose snapshot is older than the stored one
  is skipped and counted (`result="stale"`), so a retried or redriven
  message cannot undo a newer change. Rows and messages without one are
  written as before.
- **Amended (Neil, 2026-10-04): failures retry, then dead-letter with
  why.** Anything the handler does not catch is dead-lettered rather than
  requeued, so one bad message cannot spin. A write that fails for a
  reason other than its data waits in a delay queue (5 s, then 30 s, then
  5 min; `olympus-api.calendar-events.retry.*`) and comes back, ten times
  at most, counting attempts in a header. Then, and for what can never be
  written, it goes to `olympus-api.calendar-events.dead` with the reason
  and the time in headers. Admins describe the dead letters and redrive
  them to the queue (`DescribeCalendarEventDeadLetters`,
  `RedriveCalendarEventDeadLetters`); the console's Publish page shows
  them with a Redrive button.

### Schema

- New: `minerva.calendar_accounts` (`id`, `provider`, `subject`, unique
  together; `email`; `user_id`, cascade; `verified_at`;
  `verification_method`: `sign_in`, `consent`, `claim_email`,
  `claim_consent`, `migration`; audit columns) and
  `minerva.calendar_account_claims` (`id`, `account_id`, `user_id`,
  `token_hash`, `expires_at`, `confirmed_at`, `cancelled_at`, audit
  columns; at most one open per account).
- Every Minerva calendar and notes table gains `user_id` (references
  `olympus.users`, cascade), as the newer tables have:
  - `meetings`: plus `account_id` (nullable: a meeting from the old sync
    or made in Olympus has none; set null when the account goes), unique
    `(id, user_id)`, an index on `(user_id, start_time)`.
  - `notes`: unique `(id, user_id)`. `author` is dropped once the site no
    longer sends it.
  - `meeting_notes`: a composite foreign key `(note_id, user_id)` to the
    note, and none to the meeting: a link outlives its meeting, so a
    meeting synced or imported again under the same ID finds its notes.
  - `note_associations`: `(note_id, user_id)` to the note.
  - `meeting_attendees`: `(meeting_id, user_id)` to the meeting,
    cascade.
  - `meeting_user` (the people a user meets): primary key
    `(user_id, email)`.
- `meetings`, `meeting_attendees` and `meeting_user` gain the audit
  columns every table has; `note_associations` gains `updated_at`.
- The five statistics functions take a `user_id` and count only that
  user's rows.

### Existing rows are Neil's; the old sync's meetings are cleared out

The migration deletes every meeting and attendee the old sync wrote
(Neil, 2026-10-03): their raw records are archived, and a one-time import
brings them back later under their same IDs, as Neil's. Notes, meeting
links and note associations are kept, so the imported meetings find their
notes again.

The migration gives every remaining row to the user whose email is
`ncfritz@ncfritz.net`, and fails, changing nothing, if there are rows and
no such user. An empty database (a new laptop) needs no user. Accounts
already connected to the agent are linked to Neil when he first signs in
after the change, by way 1 or a claim; they are not assumed.

### Operations require an identity

Every meetings and notes operation is `@RequiresIdentity()` and scoped to
the caller: another user's meeting or note is a 404, as with goals and
reviews. A meeting created through the API belongs to its caller.

### Removing an account

Removing an account stops its calendars' sync, deletes its credential
and its meetings, and keeps the user's notes, their meeting links and
their associations.

## Consequences

- A second user can sign in and see only their own calendar, notes,
  goals and reviews. Minerva's data is per user throughout.
- Linking is provable and recorded. A typo or a guessed address cannot
  give anyone another person's calendar, and the agent can no longer
  swap one account for another on re-authorization.
- Users connect calendars from any device. The redirect URIs must be
  registered with Google and Microsoft by hand, and the agent's OAuth
  clients become web clients.
- New pieces: a service listener on the agent and a client certificate
  for the API (the first time the API calls an agent), a claim email in
  the notification agent, the API's first RabbitMQ consumer.
- The message contract and the agent's store change together; the
  contract's JSON Schema and its consumers follow.
- Events from an unowned account are not stored anywhere in Olympus until
  it is linked; the backfill fills them in then.
- Shared calendars synced by two users are stored twice, once each.
- The console keeps its pages (amended above); the site is where users
  manage accounts and calendars.
