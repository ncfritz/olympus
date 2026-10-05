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

Today (phase 0) it starts and serves `/metrics`, nothing else.

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
