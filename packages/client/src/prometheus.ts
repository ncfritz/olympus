/**
 * Request metrics on prom-client (Node only): pass the result as
 * createOlympusClients({ metrics }). The nest entry point does this itself.
 */
export { createPrometheusRequestMetrics } from "@ncfritz/olympus-metrics/prometheus";
