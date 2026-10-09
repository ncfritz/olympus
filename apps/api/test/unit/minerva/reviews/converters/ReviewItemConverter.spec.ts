import { describe, expect, it } from "vitest";
import { graphQlReviewItem } from "../../../../fixtures/minerva";
import { toDomainObject } from "../../../../../src/minerva/reviews/converters/ReviewItemConverter";

describe("ReviewItemConverter", () => {
  it("maps an open item and leaves what is unset undefined", () => {
    const item = toDomainObject(graphQlReviewItem());
    expect(item).toMatchObject({
      scope: "day",
      periodStart: "2026-10-02",
      kind: "priority",
      title: "Draft Q4 OKRs",
      status: "open",
      carryCount: 0,
    });
    expect(item.doneTime).toBeUndefined();
    expect(item.carriedFromId).toBeUndefined();
    expect(item.scheduledOn).toBeUndefined();
    expect(item.scheduledStart).toBeUndefined();
  });

  it("maps a done, carried-in, scheduled item, its times as HH:mm", () => {
    const item = toDomainObject(
      graphQlReviewItem({
        status: "done",
        doneTime: "2026-10-02T18:00:00Z",
        carriedFromId: "a1b2c3d4-0000-4000-8000-000000000009",
        carryCount: 2,
        scheduledOn: "2026-10-02",
        scheduledStart: "09:00:00",
        scheduledEnd: "11:30:00",
      }),
    );
    expect(item.doneTime?.toISOString()).toBe("2026-10-02T18:00:00.000Z");
    expect(item.carriedFromId).toBe("a1b2c3d4-0000-4000-8000-000000000009");
    expect(item.carryCount).toBe(2);
    expect(item.scheduledOn).toBe("2026-10-02");
    expect(item.scheduledStart).toBe("09:00");
    expect(item.scheduledEnd).toBe("11:30");
  });
});
