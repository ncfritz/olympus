import { ReporterService } from "nestjs-metrics-reporter";
import type { CalendarEventAction } from "@ncfritz/olympus-messages";
import type { NewSyncRun } from "../domain/syncRun";

/*
 * The agent's own Prometheus metrics, served at /metrics with Node's
 * defaults and the management API's operation metrics (MetricsModule):
 *
 *   sync_run_count{type,trigger,status}          sync runs finished
 *   sync_run_latency{type,trigger,status}        their duration (ms)
 *   sync_event_change_count{action}              events added/updated/deleted
 *   outbox_publish_count{action,outcome}         outbox rows sent, retried
 *                                                or given up (failed)
 *   webhook_notification_count{outcome}          provider push notifications:
 *                                                accepted, unknown_channel,
 *                                                token_mismatch
 */

export const recordSyncRun = (run: NewSyncRun): void => {
  const labels = { type: run.type, trigger: run.trigger, status: run.status };
  ReporterService.counter("sync_run_count", labels);
  ReporterService.histogram(
    "sync_run_latency",
    Date.parse(run.finishedAt) - Date.parse(run.startedAt),
    labels,
  );
  for (const [action, count] of [
    ["added", run.addedCount],
    ["updated", run.updatedCount],
    ["deleted", run.deletedCount],
  ] as const) {
    ReporterService.counter("sync_event_change_count", { action }, count);
  }
};

export type OutboxPublishOutcome = "sent" | "retry" | "failed";

export const recordOutboxPublish = (
  action: CalendarEventAction,
  outcome: OutboxPublishOutcome,
): void => {
  ReporterService.counter("outbox_publish_count", { action, outcome });
};

export type WebhookNotificationOutcome =
  "accepted" | "unknown_channel" | "token_mismatch";

export const recordWebhookNotification = (
  outcome: WebhookNotificationOutcome,
): void => {
  ReporterService.counter("webhook_notification_count", { outcome });
};
