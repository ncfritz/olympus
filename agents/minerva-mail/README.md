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

As a service it does nothing yet beyond `/metrics`. Phase 1a has begun
with the Takeout reader, and a command that runs it over an archive.

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

## Running it

```sh
cp agents/minerva-mail/dev.env.example agents/minerva-mail/dev.env
pnpm --filter @ncfritz/minerva-mail-agent dev
```

## Configuration

| Variable      | What     | Default |
| ------------- | -------- | ------- |
| `LISTEN_PORT` | /metrics | `3105`  |
| `LOKI_*`      | Logging  | (none)  |
