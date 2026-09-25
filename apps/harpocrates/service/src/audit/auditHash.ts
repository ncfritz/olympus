import { createHash } from "crypto";

/** The first event's previous hash. */
export const GENESIS_HASH = "0".repeat(64);

/** What an event's hash covers: everything but its own sequence and hash. */
export type HashedEvent = {
  previousHash: string;
  occurredAt: Date;
  kind: string;
  principal: string;
  surface: string;
  subjectType: string | null;
  subjectId: string | null;
  reason: string | null;
  attributes: Record<string, string>;
};

/**
 * SHA-256 over a canonical encoding: a JSON array in a fixed field order,
 * attributes sorted by name. Changing any field, or the order of events,
 * breaks every hash after it.
 */
export const hashEvent = (event: HashedEvent): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        event.previousHash,
        event.occurredAt.toISOString(),
        event.kind,
        event.principal,
        event.surface,
        event.subjectType,
        event.subjectId,
        event.reason,
        Object.entries(event.attributes).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      ]),
    )
    .digest("hex");
