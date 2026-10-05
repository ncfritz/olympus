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

## Running it

```sh
cp agents/minerva-mail/dev.env.example agents/minerva-mail/dev.env
pnpm --filter @ncfritz/minerva-mail-agent dev
```

## Configuration

| Variable       | What                                   | Default                    |
| -------------- | -------------------------------------- | -------------------------- |
| `LISTEN_PORT`  | /metrics                               | `3105`                     |
| `LOKI_*`       | Logging                                | (none)                     |
| `AMQP_*`       | The broker `mail.messages` is on       | `/dionysus-dev`            |
| `API_BASE_URL` | The Olympus API                        | `http://localhost:3100/v1` |
| `API_CLIENT_*` | This agent's certificate, for `https:` | (none)                     |
| `API_CA_CERT`  | The services CA                        | (none)                     |

In production the agent needs a service certificate (CN
`minerva-mail-agent`), `minerva-mail-agent:agent` in the API's
`AUTH_SERVICE_ROLES`, and its broker password at
`SECRETS_DIR/rabbitmq/minerva-mail-agent.password` (the user is in
`infra/docker/rabbitmq/users.json`).
