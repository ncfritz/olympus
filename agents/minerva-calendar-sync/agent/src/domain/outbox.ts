export const OUTBOX_STATUS_VALUES = ["pending", "sent", "failed"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUS_VALUES)[number];

/** "backfill" is functionally identical to "upsert" downstream (both are a full snapshot) — kept distinct so a consumer can tell a resend of current state apart from a live change (e.g. to skip notifications). */
export const OUTBOX_ACTION_VALUES = ["upsert", "delete", "backfill"] as const;
export type OutboxAction = (typeof OUTBOX_ACTION_VALUES)[number];

/** One row of the OutboxEvent table, as read back for the admin/publish-status API — see OutboxStore. */
export interface OutboxRecord {
  id: string;
  eventId: string;
  source: string;
  /** Lifted out of the row's JSON payload purely for display — the Publish page's failed-rows table shouldn't need a second round trip (or its own payload-parsing) just to show what an entry was. */
  subject: string;
  action: OutboxAction;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

/** One configured calendar's aggregated outbox state — the unit the Publish page's summary table is built from. */
export interface OutboxSourceStats {
  source: string;
  pending: number;
  sent: number;
  failed: number;
  /** createdAt of the oldest still-pending row for this source, or null if there is none — a growing age here is the signal something downstream is stuck. */
  oldestPendingAt: string | null;
}
