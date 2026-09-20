import { Registry } from "prom-client";
import { describe, expect, it } from "vitest";
import { createPrometheusRequestMetrics } from "../../src/prometheus";

const observation = {
  client: "dionysus-metadata-agent",
  server: "olympus-api",
  api: "dionysus",
  tag: "Metadata",
  operation: "CreateMovie",
  method: "post",
  statusCode: 201,
  durationSeconds: 0.2,
};

describe("createPrometheusRequestMetrics", () => {
  it("records client and server requests as labelled histograms", async () => {
    const registry = new Registry();
    const metrics = createPrometheusRequestMetrics(registry);

    metrics.observeClientRequest(observation);
    metrics.observeServerRequest({ ...observation, statusCode: undefined });

    const text = await registry.metrics();
    expect(text).toContain(
      'http_client_request_duration_seconds_count{client="dionysus-metadata-agent",server="olympus-api",api="dionysus",tag="Metadata",operation="CreateMovie",method="POST",status_code="201"} 1',
    );
    expect(text).toContain(
      'http_server_request_duration_seconds_bucket{le="0.25",client="dionysus-metadata-agent",server="olympus-api",api="dionysus",tag="Metadata",operation="CreateMovie",method="POST",status_code="none"} 1',
    );
  });

  it("reuses the histograms when created twice", () => {
    const registry = new Registry();
    createPrometheusRequestMetrics(registry);
    expect(() => createPrometheusRequestMetrics(registry)).not.toThrow();
    expect(registry.getMetricsAsArray()).toHaveLength(2);
  });
});
