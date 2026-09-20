import type { CalendarEventAction } from "@ncfritz/olympus-messages";
import { Counter, Histogram } from "prom-client";
import type { NewSyncRun } from "../domain/syncRun";

/*
 * The agent's own Prometheus metrics, on prom-client's default registry
 * (served at /metrics by MetricsModule, with the request metrics of
 * ADR 0017).
 */

const syncRuns = new Counter({
  name: "sync_runs_total",
  help: "Sync runs finished, by type, trigger and status",
  labelNames: ["type", "trigger", "status"],
});

const syncRunDuration = new Histogram({
  name: "sync_run_duration_seconds",
  help: "Duration of sync runs, by type, trigger and status",
  labelNames: ["type", "trigger", "status"],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
});

const syncEventChanges = new Counter({
  name: "sync_event_changes_total",
  help: "Events added, updated or deleted by sync runs",
  labelNames: ["action"],
});

const outboxPublishes = new Counter({
  name: "outbox_publishes_total",
  help: "Outbox rows published (sent), retried (retry) or given up (failed), by event action",
  labelNames: ["action", "outcome"],
});

const webhookNotifications = new Counter({
  name: "webhook_notifications_total",
  help: "Provider push notifications: accepted, unknown_channel or token_mismatch",
  labelNames: ["outcome"],
});

export const recordSyncRun = (run: NewSyncRun): void => {
  const labels = { type: run.type, trigger: run.trigger, status: run.status };
  syncRuns.inc(labels);
  syncRunDuration.observe(
    labels,
    (Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000,
  );
  syncEventChanges.inc({ action: "added" }, run.addedCount);
  syncEventChanges.inc({ action: "updated" }, run.updatedCount);
  syncEventChanges.inc({ action: "deleted" }, run.deletedCount);
};

export type OutboxPublishOutcome = "sent" | "retry" | "failed";

export const recordOutboxPublish = (
  action: CalendarEventAction,
  outcome: OutboxPublishOutcome,
): void => {
  outboxPublishes.inc({ action, outcome });
};

export type WebhookNotificationOutcome =
  "accepted" | "unknown_channel" | "token_mismatch";

export const recordWebhookNotification = (
  outcome: WebhookNotificationOutcome,
): void => {
  webhookNotifications.inc({ outcome });
};
