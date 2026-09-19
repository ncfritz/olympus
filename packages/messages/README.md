# @ncfritz/olympus-messages

The RabbitMQ contracts between the API and the agents: exchanges, routes
(exchange + routing key + payload type) and payload types. Publishers and
consumers compile against the same definitions, so a renamed field or key
fails the build instead of silently dropping messages.

| Module          | Exchanges                                           | Flow                                              |
| --------------- | --------------------------------------------------- | ------------------------------------------------- |
| `notifications` | `notifications.trigger`                             | API SendNotification → notification agent         |
| `batchJobs`     | `batchJob.trigger`, `batchJob.workflow`             | API → metadata agents; agents → their workflow    |
| `metadataJobs`  | `metadataJob.trigger`                               | API → metadata agents                             |
| `content`       | `content.trigger`                                   | API → asset agents                                |
| `media`         | `media.trigger`                                     | API and asset agents → asset agents               |
| `downloads`     | `download.trigger`, `download.update`               | API → asset agents; NZBGet scripts → asset agents |
| `search`        | `search.execution.trigger`, `search.fanout.trigger` | API and search agents → search agents             |

## Use

```ts
// publish (API or agent), with the injected AmqpConnection
await publishMessage(this.amqpConnection, metadataJobRoute(job.type), {
  entityId: job.id,
  entityType: job.type,
}, delayed(10000));

// consume
@RabbitSubscribe(subscription(metadataJobRoute("movies"), "metadataJob.movies.trigger"))

// declare, in RabbitModule
exchanges: declare(METADATA_JOB_TRIGGER_EXCHANGE, BATCH_JOB_TRIGGER_EXCHANGE),
```

- Payload enums are string unions (`values.ts`) so agents don't depend on
  the model; the API's tests check they match the model's enums.
- `publishMessage` only accepts the payload type of the route.
- Delayed exchanges (`x-delayed-message`) take `delayed(ms)`.

## Non-TypeScript publishers

The NZBGet extension scripts (Python, `agents/dionysus-search/scripts`)
publish `download.update`. `schemas/download-update.schema.json` is
generated from `DownloadUpdateMessage` (`pnpm schemas`; a test fails when
it is stale), and the search agent's tests check the scripts against it.
