# @ncfritz/olympus-metrics

The platform's request metrics convention (ADR 0017), shared by servers
(the API, agents with a management API) and clients (agents, the site):

- `http_client_request_duration_seconds`, recorded by the caller, and
  `http_server_request_duration_seconds`, recorded by the callee: seconds,
  with the labels `client`, `server`, `api`, `tag`, `operation`, `method`
  and `status_code`.
- `CLIENT_HEADER` (`X-Olympus-Client`): every client sends its name, so a
  server can break its numbers down by caller (`clientLabel()` turns the
  header into a label value: `unknown` without one, `other` when invalid).
- `operationsFromOpenApi()` and `createOperationLookup()`: map a request
  (method and path, concrete or an Express route template) to its API
  document, tag and operationId.

The main entry point has no dependencies and runs in browsers.
`@ncfritz/olympus-metrics/prometheus` records the histograms with
prom-client (Node only; `prom-client` is a peer dependency).

```ts
import { createPrometheusRequestMetrics } from "@ncfritz/olympus-metrics/prometheus";

const metrics = createPrometheusRequestMetrics(); // prom-client's default registry
metrics.observeClientRequest({
  client: "dionysus-metadata-agent",
  server: "olympus-api",
  api: "dionysus",
  tag: "Metadata",
  operation: "CreateMovie",
  method: "POST",
  statusCode: 201,
  durationSeconds: 0.12,
});
```

Nest services get all of this wired by `MetricsModule` in
`@ncfritz/olympus-nest`, and clients by `@ncfritz/olympus-client`.
