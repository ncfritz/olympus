# The user directory

Who may sign in, and what their tokens say they can do.

Signing in never creates anyone. A provider identity links to a user that
already exists; a person the directory does not know is refused, whatever
Google or GitHub says about them (ADR 0018). So the directory starts empty
and nobody can sign in until it has been filled in by hand — which is the
intent, not an omission. A home lab's user list is short and deliberate, and
an account appearing because somebody authenticated somewhere else is not a
thing that should be able to happen.

`auth:user` is how it is filled in.

## Running it

It needs Hasura's admin secret, so where it runs depends on which
environment it is administering.

| Environment          | Command                                                           |
| -------------------- | ----------------------------------------------------------------- |
| dev (the Mac Mini)   | `pnpm --filter @ncfritz/olympus-api auth:user <command>`          |
| a laptop's own stack | `pnpm --filter @ncfritz/olympus-api auth:user:local <command>`    |
| production           | `docker compose exec olympus-api node dist/authUser.js <command>` |

The first two read `apps/api/dev.env` and `local.env`, and need
`pnpm --filter @ncfritz/olympus-api build` first — the CLI is a webpack
entry point beside the server, not something run from source.

Production is the exception worth knowing: there the admin secret is a file
inside the container (`/run/secrets/hasura_admin_secret`), so the CLI runs
in the container rather than on the host. `auth:user:prod` exists for a
laptop pointed at production resources, and works only if
`apps/api/production.env` can reach the secret.

## Commands

```
list                              every user, with roles and linked identities
show    <email|id>                one user
add     <email> <name> [role...]  creates a user
roles   <email|id> <role...>      replaces their roles with exactly these
roles   <email|id> --clear        removes all of their roles
disable <email|id>                refuse them at the next sign-in or refresh
enable  <email|id>                undo that
unlink  <email|id> <provider>     forget a provider identity, so it links again
```

A user can be named by email or by id. Email is matched case-insensitively,
against the column Postgres generates as `lower(btrim(email))` — so the
casing anyone types is irrelevant for finding someone, and the casing they
signed up with is still what is displayed.

The first user, on a new host:

```
$ pnpm --filter @ncfritz/olympus-api auth:user add neil@example.com "Neil Fritz" admin
```

## Roles

Free-form strings, compared exactly by the guard. That is why the CLI
insists on lower case: `Admin` and `admin` would be two different roles, and
the symptom is an endpoint refusing someone for no visible reason. There is
no fixed vocabulary yet.

`roles` replaces the whole set rather than adding to it, and clearing them
all takes `--clear` rather than an empty argument list — a forgotten role
list should not silently strip someone's access.

## Disabling someone

`disable` rather than deleting them. A disabled user is refused at sign-in
_and_ at every token refresh, so their access ends within the access token's
ten minutes instead of at its thirty-day expiry. Deleting the row would end
the sessions too, but it also loses the audit trail of which provider
identities were ever linked.

## When a first sign-in goes wrong

The first sign-in with a provider links that provider identity to a user **by
verified email**. If it linked the wrong one — a provider configured against
the wrong account, a shared address — `unlink` forgets the identity, and the
next sign-in links again from scratch.

`show` is what to look at first: it lists every provider identity, with the
subject the provider gave and the address it was linked by.

| Symptom                                               | Cause                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Sign-in redirects back with `error=access_denied`     | Deliberately vague. The reason is in the API's log, never in the redirect. |
| The log says "no user with the email <provider> gave" | Nobody in the directory has that address. `add` them.                      |
| The log says "<provider> did not verify <address>"    | The provider did not mark the address verified, so it cannot be a key.     |
| The log says "user <id> is disabled"                  | `enable` them.                                                             |
| `auth:user` says every query would be refused         | `HASURA_PASSWORD`/`HASURA_PASSWORD_FILE` is unset for that environment.    |
| `add` says the address is already someone             | It matches an existing user's normalized email; `show` it.                 |

The vagueness in the first row is on purpose: "no user with that email" and
"the provider rejected the code" are the same `access_denied` to the browser,
because the difference would tell an attacker whether an address is one of
ours.
