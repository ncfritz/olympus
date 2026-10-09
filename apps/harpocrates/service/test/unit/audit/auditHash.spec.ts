import { describe, expect, it } from "vitest";
import { GENESIS_HASH, hashEvent } from "../../../src/audit/auditHash";

const event = {
  previousHash: GENESIS_HASH,
  occurredAt: new Date("2026-09-25T12:00:00.000Z"),
  kind: "certificate.issued",
  principal: "user:1",
  surface: "api",
  subjectType: "certificate",
  subjectId: "c1",
  reason: null,
  attributes: { serial: "abc", issuerId: "tls-issuing-1-g1" },
};

describe("audit hashes", () => {
  it("is stable, whatever order the attributes come in", () => {
    const reordered = {
      ...event,
      attributes: { issuerId: "tls-issuing-1-g1", serial: "abc" },
    };
    expect(hashEvent(reordered)).toBe(hashEvent(event));
    expect(hashEvent(event)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with any field or the previous hash", () => {
    const base = hashEvent(event);
    expect(hashEvent({ ...event, kind: "certificate.revoked" })).not.toBe(base);
    expect(hashEvent({ ...event, previousHash: "1".repeat(64) })).not.toBe(
      base,
    );
    expect(
      hashEvent({
        ...event,
        attributes: { ...event.attributes, serial: "abd" },
      }),
    ).not.toBe(base);
  });
});
