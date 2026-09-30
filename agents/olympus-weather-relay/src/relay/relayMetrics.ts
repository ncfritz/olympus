import { Counter } from "prom-client";

/**
 * Lines relayed, by what the API made of them (`stored`, `duplicate`,
 * `unknown_station`, `invalid`, `skipped`), or `failed` when the API did
 * not answer and the line went back on the queue.
 */
const relayedLines = new Counter({
  name: "weather_relay_lines_total",
  help: "Weather archive lines relayed into this environment, by outcome",
  labelNames: ["result"],
});

export const recordRelayedLine = (result: string): void => {
  relayedLines.inc({ result });
};
