import moment from "moment";
import type { OutboxRecord, OutboxSourceStats } from "../../domain/outbox";
import type { OutboxEvent, OutboxSourceSummary } from "../../model/outbox";

/** A stored outbox row as the management API returns it. */
export const toDomainObject = (record: OutboxRecord): OutboxEvent => ({
  id: record.id,
  eventId: record.eventId,
  source: record.source,
  subject: record.subject,
  action: record.action,
  status: record.status,
  attempts: record.attempts,
  lastError: record.lastError ?? undefined,
  createdAt: moment.utc(record.createdAt),
  sentAt: record.sentAt ? moment.utc(record.sentAt) : undefined,
});

export const toSourceSummary = (
  stats: OutboxSourceStats,
  calendarId: string | undefined,
): OutboxSourceSummary => ({
  source: stats.source,
  calendarId,
  pending: stats.pending,
  sent: stats.sent,
  failed: stats.failed,
  oldestPendingAt: stats.oldestPendingAt
    ? moment.utc(stats.oldestPendingAt)
    : undefined,
});
