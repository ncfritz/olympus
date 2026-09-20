import type { calendar_v3 } from "googleapis";
import {
  mapGoogleEventToCanonical,
  resolveGoogleRemoval,
} from "../../../../src/providers/google/googleEventMapper";
import { describe, expect, it } from "vitest";

type GoogleEvent = calendar_v3.Schema$Event;

function baseEvent(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: "google-id-1",
    iCalUID: "ical-uid-1@google.com",
    summary: "Team sync",
    status: "confirmed",
    start: { dateTime: "2026-01-05T10:00:00-05:00" },
    end: { dateTime: "2026-01-05T10:30:00-05:00" },
    ...overrides,
  };
}

const ctx = { source: "personal-gmail" };

describe("mapGoogleEventToCanonical", () => {
  it("maps the common fields", () => {
    const result = mapGoogleEventToCanonical(baseEvent(), ctx, null);

    expect(result.id).toBe("personal-gmail:ical-uid-1@google.com");
    expect(result.uid).toBe("ical-uid-1@google.com");
    expect(result.source).toBe("personal-gmail");
    expect(result.subject).toBe("Team sync");
    expect(result.startTime).toBe("2026-01-05T15:00:00.000Z");
    expect(result.endTime).toBe("2026-01-05T15:30:00.000Z");
    expect(result.duration).toBe(30);
    expect(result.allDay).toBe(false);
  });

  it("defaults a missing summary to '(No title)'", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ summary: undefined }),
      ctx,
      null,
    );
    expect(result.subject).toBe("(No title)");
  });

  it("maps an all-day event from date-only start/end", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ start: { date: "2026-01-05" }, end: { date: "2026-01-06" } }),
      ctx,
      null,
    );

    expect(result.allDay).toBe(true);
    expect(result.startTime).toBe("2026-01-05T00:00:00.000Z");
    expect(result.endTime).toBe("2026-01-06T00:00:00.000Z");
    expect(result.duration).toBe(24 * 60);
  });

  it.each([
    ["private", "private"],
    ["confidential", "confidential"],
    ["public", "normal"],
    ["default", "normal"],
    [undefined, "normal"],
  ] as const)(
    "maps visibility %s to sensitivity %s",
    (visibility, expected) => {
      const result = mapGoogleEventToCanonical(
        baseEvent({ visibility }),
        ctx,
        null,
      );
      expect(result.sensitivity).toBe(expected);
    },
  );

  it("defaults importance to normal", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx, null).importance).toBe(
      "normal",
    );
  });

  it("honors a valid extendedProperties importance override", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ extendedProperties: { private: { importance: "high" } } }),
      ctx,
      null,
    );
    expect(result.importance).toBe("high");
  });

  it("ignores an invalid extendedProperties importance override", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ extendedProperties: { private: { importance: "urgent!" } } }),
      ctx,
      null,
    );
    expect(result.importance).toBe("normal");
  });

  it("classifies occurrenceType from recurringEventId / recurrence", () => {
    expect(
      mapGoogleEventToCanonical(baseEvent(), ctx, null).occurrenceType,
    ).toBe("single");
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ recurringEventId: "master-1" }),
        ctx,
        null,
      ).occurrenceType,
    ).toBe("occurrence");
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ recurrence: ["RRULE:FREQ=WEEKLY"] }),
        ctx,
        null,
      ).occurrenceType,
    ).toBe("series_master");
  });

  it("carries Google's recurringEventId through as recurrenceId", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ recurringEventId: "master-1" }),
      ctx,
      null,
    );
    expect(result.recurrenceId).toBe("master-1");
  });

  it("classifies type from attendee count, overridden by a non-default eventType", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx, null).type).toBe(
      "appointment",
    );
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ attendees: [{ email: "a@x.com" }, { email: "b@x.com" }] }),
        ctx,
        null,
      ).type,
    ).toBe("meeting");
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ eventType: "outOfOffice" }),
        ctx,
        null,
      ).type,
    ).toBe("other");
  });

  it("derives reminder from useDefault or overrides", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx, null).reminder).toBe(
      false,
    );
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ reminders: { useDefault: true } }),
        ctx,
        null,
      ).reminder,
    ).toBe(true);
    expect(
      mapGoogleEventToCanonical(
        baseEvent({
          reminders: {
            useDefault: false,
            overrides: [{ method: "popup", minutes: 10 }],
          },
        }),
        ctx,
        null,
      ).reminder,
    ).toBe(true);
  });

  it("maps response: organizer takes priority over attendee status", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ organizer: { self: true } }),
      ctx,
      null,
    );
    expect(result.response).toBe("organizer");
  });

  it.each([
    ["accepted", "accepted"],
    ["declined", "declined"],
    ["tentative", "tentative"],
    ["needsAction", "needs_action"],
  ] as const)(
    "maps self attendee responseStatus %s to %s",
    (responseStatus, expected) => {
      const result = mapGoogleEventToCanonical(
        baseEvent({
          attendees: [{ email: "me@x.com", self: true, responseStatus }],
        }),
        ctx,
        null,
      );
      expect(result.response).toBe(expected);
    },
  );

  it("defaults response to accepted with no organizer flag and no self attendee", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx, null).response).toBe(
      "accepted",
    );
  });

  it("maps free/busy status from transparency", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx, null).status).toBe(
      "busy",
    );
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ transparency: "transparent" }),
        ctx,
        null,
      ).status,
    ).toBe("free");
  });

  it("maps cancelled from Google's event status field", () => {
    expect(
      mapGoogleEventToCanonical(baseEvent({ status: "cancelled" }), ctx, null)
        .cancelled,
    ).toBe(true);
  });

  it("derives a uid from Google's id when iCalUID is missing (legacy/malformed events)", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ iCalUID: undefined, id: "raw-id-1" }),
      ctx,
      null,
    );
    expect(result.uid).toBe("raw-id-1@google.com");
  });

  it("derives uid from the instance's own id, not the series' shared iCalUID, for a recurring occurrence", () => {
    // Google gives every occurrence of one series the SAME iCalUID (it names
    // the series, not the date) but a distinct `id` per instance. Keying uid
    // off iCalUID here would collapse all occurrences onto one stored row.
    const first = mapGoogleEventToCanonical(
      baseEvent({
        id: "series-1_20260105",
        iCalUID: "series-1@google.com",
        recurringEventId: "series-1",
      }),
      ctx,
      null,
    );
    const second = mapGoogleEventToCanonical(
      baseEvent({
        id: "series-1_20260112",
        iCalUID: "series-1@google.com",
        recurringEventId: "series-1",
      }),
      ctx,
      null,
    );

    expect(first.uid).toBe("series-1_20260105@google.com");
    expect(second.uid).toBe("series-1_20260112@google.com");
    expect(first.uid).not.toBe(second.uid);
  });

  it("throws when both id and iCalUID are missing", () => {
    expect(() =>
      mapGoogleEventToCanonical(
        baseEvent({ id: undefined, iCalUID: undefined }),
        ctx,
        null,
      ),
    ).toThrow(/no id/);
  });

  it("throws when start or end is missing", () => {
    expect(() =>
      mapGoogleEventToCanonical(baseEvent({ start: undefined }), ctx, null),
    ).toThrow();
  });

  it("carries the resolved recurrenceRule straight through onto the canonical event", () => {
    // The mapper never reads raw.recurrence itself for this — see its
    // doc comment — it just trusts whatever the caller already resolved.
    expect(
      mapGoogleEventToCanonical(baseEvent(), ctx, "RRULE:FREQ=WEEKLY;BYDAY=MO")
        .recurrenceRule,
    ).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(
      mapGoogleEventToCanonical(baseEvent(), ctx, null).recurrenceRule,
    ).toBeNull();
  });
});

describe("resolveGoogleRemoval", () => {
  it("derives uid from iCalUID for a standalone event's removal", () => {
    const result = resolveGoogleRemoval({
      id: "raw-id-1",
      iCalUID: "ical-uid-1@google.com",
      status: "cancelled",
    });
    expect(result).toEqual({
      uid: "ical-uid-1@google.com",
      isOccurrence: false,
    });
  });

  it("derives uid from the instance's own id, ignoring iCalUID, for an occurrence's removal", () => {
    // Even if a removal stub happened to carry the series' shared iCalUID,
    // using it would wrongly target every occurrence's row instead of just
    // the one actually removed.
    const result = resolveGoogleRemoval({
      id: "series-1_20260105",
      iCalUID: "series-1@google.com",
      recurringEventId: "series-1",
      status: "cancelled",
    });
    expect(result).toEqual({
      uid: "series-1_20260105@google.com",
      isOccurrence: true,
    });
  });

  it("falls back to the id-derived convention when iCalUID is absent", () => {
    const result = resolveGoogleRemoval({
      id: "raw-id-1",
      status: "cancelled",
    });
    expect(result).toEqual({ uid: "raw-id-1@google.com", isOccurrence: false });
  });

  it("throws when id is missing", () => {
    expect(() => resolveGoogleRemoval({ status: "cancelled" })).toThrow(
      /no id/,
    );
  });
});
