# minerva-mail-agent

`@ncfritz/minerva-mail-agent`: a Gmail mailbox's labels and message
metadata into Minerva, and reviewed label changes back to Gmail
([ADR 0030](../../docs/decisions/0030-email-management.md),
[the plan](../../docs/plans/email-management/README.md)).

It reads mail from a Google Takeout archive (phase 1a, no Gmail API calls)
or from the Gmail API (phase 1b), publishes each message's metadata to
`mail.messages` for the API to store, and sends the text, in memory only,
to the classifier (`agents/minerva-mail-ml`). Message bodies are never
written anywhere; only Gmail's snippet is kept.

As a service it does nothing yet beyond `/metrics`. Phase 1a's work is a
command: it scans a Takeout archive, and imports it.

## The Takeout command

```sh
pnpm --filter @ncfritz/minerva-mail-agent build
pnpm --filter @ncfritz/minerva-mail-agent takeout scan ~/Downloads/Takeout/Mail/mail.mbox
```

`scan` reads and parses the archive exactly as the import will, then prints
what it found as JSON: counts only, never content. It writes nothing,
publishes nothing and leaves the archive as it is. `--max-seconds` stops
after a time budget and prints `nextOffset`; `--offset` resumes from it.
`--limit` stops after a number of messages.

```sh
pnpm --filter @ncfritz/minerva-mail-agent takeout import ~/Downloads/Takeout/Mail/mail.mbox \
  --account neil@example.net --owner neil@example.net --max-seconds 150
```

`import` makes the mailbox's account the owner's through the API
(`POST /mail/accounts/import`, verification `import`), then publishes each
message's metadata and snippet to `mail.messages` (`message.upsert`) for
the API to store. Chats, trash, spam and drafts are skipped. Publishing a
message again rewrites its row, so a run stopped by `--max-seconds` or
`--limit` resumes with `--offset` from the `nextOffset` it prints, and a
repeated run is harmless. It needs the broker and the API, configured as
below; `scan` needs neither.

```sh
pnpm --filter @ncfritz/minerva-mail-agent takeout featurize ~/Downloads/Takeout/Mail/mail.mbox \
  --account neil@example.net --owner neil@example.net
```

`featurize` sends every kept message's text, 200 at a time, to the
classifier's services listener (`MAIL_ML_URL`, mutual TLS with this
agent's certificate), which keeps hashed word counts and drops the text.
Reaching the archive's end marks the classifier's feature version
complete, so its models use it; `--no-complete` leaves it building. It
resumes with `--offset` like `import`, and a message featurized again
replaces its row. It needs the API (for the account) and the classifier,
not the broker.

## The Gmail command

```sh
pnpm --filter @ncfritz/minerva-mail-agent gmail reconcile neil@example.net
```

`reconcile` brings a mailbox linked from Minerva's Mail inbox into step
with Gmail, read-only (`gmail.readonly`): every label gets its Gmail ID
(labels made in Gmail since the export are added); each label's message
IDs are listed (500 a call) and every message's labels, categories and
flags compared with Minerva's, publishing `message.labels` where they
differ and `message.delete` for mail Gmail no longer has (drafts and chats
included, as the import skips them); mail Minerva lacks is fetched whole
(`format=raw`), parsed as the import parses it and published as
`message.upsert`, its text sent to the classifier when `MAIL_ML_URL` is
set. Gmail's API names only `STARRED`, so each star icon is found by
one search (`has:red-bang`, twelve in all), and the report counts the
starred messages by icon. Requests are spaced 50 ms apart and retried with
backoff when Google says to slow down. At the end, if nothing failed, it
records the `historyId` it started from and Gmail's totals. It prints
counts as JSON, never content, and is safe to run again; a run cut short
is finished by the next. It needs the broker, the API and Gmail's client
(`MAIL_GOOGLE_OAUTH_CLIENT_ID`, `MAIL_GOOGLE_OAUTH_CLIENT_SECRET_FILE`,
`MAIL_CREDENTIALS_DIR`).

```sh
pnpm --filter @ncfritz/minerva-mail-agent gmail poll [neil@example.net]
```

`poll` does once what the running agent does every
`MAIL_GMAIL_POLL_SECONDS` (60 by default): for each linked mailbox (or
the one named), `history.list` from the recorded `historyId`, then the
current state of each message history names. New mail, and mail taken
out of Spam or Trash, is fetched whole, published and featurized; a
message whose labels changed is read with a minimal get and published as
`message.labels`; one deleted, or moved to Spam, Trash or the drafts, as
`message.delete`. Drafts being saved and chats are passed over. When a star was given or taken,
the twelve icon searches run too. A label
Minerva has not seen is read and synced first. Once everything is
published the new `historyId` and Gmail's totals are recorded, so a poll
that fails part way is repeated. A mailbox with no `historyId` yet, or
whose history Gmail no longer keeps (404, after about a week), is
reconciled instead, at most once an hour.

## Running it

```sh
cp agents/minerva-mail/dev.env.example agents/minerva-mail/dev.env
pnpm --filter @ncfritz/minerva-mail-agent dev
```

## Configuration

| Variable                                         | What                                     | Default                     |
| ------------------------------------------------ | ---------------------------------------- | --------------------------- |
| `LISTEN_PORT`                                    | /metrics                                 | `3105`                      |
| `LOKI_*`                                         | Logging                                  | (none)                      |
| `AMQP_*`                                         | The broker `mail.messages` is on         | `/dionysus-dev`             |
| `API_BASE_URL`                                   | The Olympus API                          | `http://localhost:3100/v1`  |
| `API_CLIENT_*`                                   | This agent's certificate, for `https:`   | (none)                      |
| `API_CA_CERT`                                    | The services CA                          | (none)                      |
| `MAIL_ML_URL`                                    | The classifier's services listener       | (none: no `featurize`)      |
| `MAIL_ML_CLIENT_CERT`, `_KEY`, `MAIL_ML_CA_CERT` | Its client certificate, if not the API's | the `API_*` ones            |
| `MAIL_ML_TIMEOUT_MS`                             | Per request to the classifier            | `60000`                     |
| `MAIL_GOOGLE_OAUTH_CLIENT_ID`, `_SECRET(_FILE)`  | Gmail's OAuth client                     | (none: no linking, polling) |
| `MAIL_CREDENTIALS_DIR`                           | Refresh tokens, one file per mailbox     | `data/credentials`          |
| `MAIL_GMAIL_POLL_SECONDS`                        | Between history polls; `0` turns it off  | `60`                        |

In production the agent needs a service certificate (CN
`minerva-mail-agent`), `minerva-mail-agent:agent` in the API's
`AUTH_SERVICE_ROLES`, and its broker password at
`SECRETS_DIR/rabbitmq/minerva-mail-agent.password` (the user is in
`infra/docker/rabbitmq/users.json`).
