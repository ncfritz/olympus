# 0017. Shared API client and request metrics

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

Each agent wrapped the SDK operations it used in its own `api/` folder
(ADR 0015). The four copies of the module that configures the SDK were
identical, three agents wrapped `sendNotification` separately, and the
wrappers disagreed on naming, return shapes and what a `404` means. Only
the metadata agent recorded client metrics, under names that differed
from the one other agent that did.

The metrics themselves put the operation in the metric name
(`client_Dionysus_CreateMovie_2xx`, `operation_ListCalendars_latency`):
about a dozen counters per operation, which dashboards cannot group or
filter, and which Prometheus rejects when a name contains a dot. Neither
side could tell who was calling: the API's numbers could not be broken
down by client, and a client's numbers could not be set against the
API's for the same operations.

The site, still to be imported, calls the same APIs from Next.js, in the
browser and on the server.

## Decision

### Request metrics

Every HTTP call between services is measured on both sides, with the
same labels, as a histogram in seconds (the OpenTelemetry HTTP names):

| Metric                                 | Recorded by           | `client`                        | `server`                                        |
| -------------------------------------- | --------------------- | ------------------------------- | ----------------------------------------------- |
| `http_server_request_duration_seconds` | the service answering | the caller's `X-Olympus-Client` | itself (`olympus-api`, ...)                     |
| `http_client_request_duration_seconds` | the service calling   | itself                          | the service called (`olympus-api`, `tmdb`, ...) |

plus `api` (the OpenAPI document: `olympus`, `dionysus`, `minerva`,
`minerva-calendar-sync`; or the external service), `tag` (the operation's
OpenAPI tag), `operation` (its operationId), `method` and `status_code`
(`none` when no response came back). Every metric also carries `app`
and `environment`.

- Every Olympus client sends `X-Olympus-Client: <name>`, lower case with
  dashes; agents send their app name. A server records `unknown` without
  the header and `other` for an invalid one, so the label stays bounded.
- A server records only requests that match an operation of its
  documents, from Express middleware that runs before guards, so
  rejected requests count. Clients find the operation called from a
  table the SDK generates from the same documents.
- Rates, error ratios and quantiles come from the histograms
  (`_count`, `_bucket`); no separate counters per status.
- A service's own metrics use conventional names (`_total` for
  counters, base units such as `_seconds`), labels for the breakdown.

`@ncfritz/olympus-metrics` holds the convention (names, labels, the
header, the operation lookup) with no dependencies, and a prom-client
recorder. `@ncfritz/olympus-nest` provides `MetricsModule` (`/metrics` on
prom-client's default registry, replacing `nestjs-metrics-reporter`), the
server middleware and `ExecuteWithMetrics` for calls to other services.

### The client package

`@ncfritz/olympus-client` replaces the agents' `api/` folders:

- `createOlympusClients({ baseUrl, clientName, metrics })` creates an SDK
  client per API document, sending the header and recording the client
  metric. The main entry point runs in browsers and Node; `/prometheus`
  and `/nest` (`OlympusClientModule`) are for Node and Nest.
- Wrappers, one per API area (`ContentApi`, `MediaApi`,
  `MediaSearchApi`, `MetadataApi`, `JobApi`, `MetadataWorkflowApi`,
  `NotificationApi`), are plain classes over those clients. A method is
  named after the SDK function it calls, takes plain arguments, returns
  the unwrapped model and knows no caller's types. A `404` throws unless
  the method returns `T | undefined`.
- A call no wrapper covers is added to the package, not to the caller.

## Consequences

- An API dashboard can show each API's traffic, errors and latency
  (`server="olympus-api"`) and break it down by client; a client's
  dashboard can set its own numbers for an operation against the API's.
  The difference between the two sides of the same call is the network,
  the proxy or the client's queueing.
- All the old metric names are gone (`client_*`, `operation_*`, the
  agents' reporter-registry metrics). No dashboard or alert used them.
- The API builds its OpenAPI documents once, on the first request, to
  know its operations.
- Servers must allow the header in CORS for browser callers; the API
  reflects requested headers already.
- The wrappers are tested once, in the package, including that every
  method calls the operation it is named after; agents mock them by
  class as before.
- What a `404` means is still decided per method; callers disagree, and
  the site import is where that is settled (roadmap, "Not-found
  handling").
- This amends ADR 0015: agents no longer keep `api/` wrappers.
