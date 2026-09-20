/**
 * The request metrics as Prometheus histograms (Node only). Registered on
 * prom-client's default registry unless another is given; creating them
 * twice returns the existing ones.
 */
import {
  Histogram,
  register as defaultRegistry,
  type Registry,
} from "prom-client";
import {
  DURATION_BUCKETS,
  HTTP_CLIENT_REQUEST_DURATION,
  HTTP_SERVER_REQUEST_DURATION,
  REQUEST_LABELS,
} from "./conventions";
import {
  requestLabels,
  type RequestMetrics,
  type RequestObservation,
} from "./observations";

const histogram = (registry: Registry, name: string, help: string) =>
  (registry.getSingleMetric(name) as Histogram<string> | undefined) ??
  new Histogram({
    name,
    help,
    labelNames: [...REQUEST_LABELS],
    buckets: DURATION_BUCKETS,
    registers: [registry],
  });

export const createPrometheusRequestMetrics = (
  registry: Registry = defaultRegistry,
): RequestMetrics => {
  const client = histogram(
    registry,
    HTTP_CLIENT_REQUEST_DURATION,
    "Duration of HTTP requests this service made, by the service called and its operation",
  );
  const server = histogram(
    registry,
    HTTP_SERVER_REQUEST_DURATION,
    "Duration of HTTP requests this service answered, by caller and operation",
  );
  const observe = (h: Histogram<string>, o: RequestObservation) =>
    h.observe(requestLabels(o), o.durationSeconds);
  return {
    observeClientRequest: (o) => observe(client, o),
    observeServerRequest: (o) => observe(server, o),
  };
};
