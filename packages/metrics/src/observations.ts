import { type RequestLabels, statusCodeLabel } from "./conventions";

/** One HTTP request, as a caller or callee measured it. */
export interface RequestObservation {
  client: string;
  server: string;
  api: string;
  tag: string;
  operation: string;
  method: string;
  /** Undefined when no response came back. */
  statusCode?: number;
  durationSeconds: number;
}

/** Where observations go (Prometheus on Node; nowhere in a browser). */
export interface RequestMetrics {
  observeClientRequest(observation: RequestObservation): void;
  observeServerRequest(observation: RequestObservation): void;
}

/** The labels of an observation. */
export const requestLabels = (o: RequestObservation): RequestLabels => ({
  client: o.client,
  server: o.server,
  api: o.api,
  tag: o.tag,
  operation: o.operation,
  method: o.method.toUpperCase(),
  status_code: statusCodeLabel(o.statusCode),
});
