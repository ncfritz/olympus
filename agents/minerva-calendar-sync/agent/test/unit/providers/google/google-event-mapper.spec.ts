import type { calendar_v3 } from "googleapis";
import { mapGoogleEventToCanonical } from "../../../../src/providers/google/google-event-mapper";

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
    const result = mapGoogleEventToCanonical(baseEvent(), ctx);

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
    const result = mapGoogleEventToCanonical(baseEvent({ summary: undefined }), ctx);
    expect(result.subject).toBe("(No title)");
  });

  it("maps an all-day event from date-only start/end", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ start: { date: "2026-01-05" }, end: { date: "2026-01-06" } }),
      ctx,
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
  ] as const)("maps visibility %s to sensitivity %s", (visibility, expected) => {
    const result = mapGoogleEventToCanonical(baseEvent({ visibility }), ctx);
    expect(result.sensitivity).toBe(expected);
  });

  it("defaults importance to normal", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx).importance).toBe("normal");
  });

  it("honors a valid extendedProperties importance override", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ extendedProperties: { private: { importance: "high" } } }),
      ctx,
    );
    expect(result.importance).toBe("high");
  });

  it("ignores an invalid extendedProperties importance override", () => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ extendedProperties: { private: { importance: "urgent!" } } }),
      ctx,
    );
    expect(result.importance).toBe("normal");
  });

  it("classifies occurrenceType from recurringEventId / recurrence", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx).occurrenceType).toBe("single");
    expect(
      mapGoogleEventToCanonical(baseEvent({ recurringEventId: "master-1" }), ctx).occurrenceType,
    ).toBe("occurrence");
    expect(
      mapGoogleEventToCanonical(baseEvent({ recurrence: ["RRULE:FREQ=WEEKLY"] }), ctx).occurrenceType,
    ).toBe("series_master");
  });

  it("carries Google's recurringEventId through as recurrenceId", () => {
    const result = mapGoogleEventToCanonical(baseEvent({ recurringEventId: "master-1" }), ctx);
    expect(result.recurrenceId).toBe("master-1");
  });

  it("classifies type from attendee count, overridden by a non-default eventType", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx).type).toBe("appointment");
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ attendees: [{ email: "a@x.com" }, { email: "b@x.com" }] }),
        ctx,
      ).type,
    ).toBe("meeting");
    expect(mapGoogleEventToCanonical(baseEvent({ eventType: "outOfOffice" }), ctx).type).toBe("other");
  });

  it("derives reminder from useDefault or overrides", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx).reminder).toBe(false);
    expect(
      mapGoogleEventToCanonical(baseEvent({ reminders: { useDefault: true } }), ctx).reminder,
    ).toBe(true);
    expect(
      mapGoogleEventToCanonical(
        baseEvent({ reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] } }),
        ctx,
      ).reminder,
    ).toBe(true);
  });

  it("maps response: organizer takes priority over attendee status", () => {
    const result = mapGoogleEventToCanonical(baseEvent({ organizer: { self: true } }), ctx);
    expect(result.response).toBe("organizer");
  });

  it.each([
    ["accepted", "accepted"],
    ["declined", "declined"],
    ["tentative", "tentative"],
    ["needsAction", "needs_action"],
  ] as const)("maps self attendee responseStatus %s to %s", (responseStatus, expected) => {
    const result = mapGoogleEventToCanonical(
      baseEvent({ attendees: [{ email: "me@x.com", self: true, responseStatus }] }),
      ctx,
    );
    expect(result.response).toBe(expected);
  });

  it("defaults response to accepted with no organizer flag and no self attendee", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx).response).toBe("accepted");
  });

  it("maps free/busy status from transparency", () => {
    expect(mapGoogleEventToCanonical(baseEvent(), ctx).status).toBe("busy");
    expect(mapGoogleEventToCanonical(baseEvent({ transparency: "transparent" }), ctx).status).toBe(
      "free",
    );
  });

  it("maps cancelled from Google's event status field", () => {
    expect(mapGoogleEventToCanonical(baseEvent({ status: "cancelled" }), ctx).cancelled).toBe(true);
  });

  it("derives a uid from Google's id when iCalUID is missing (legacy/malformed events)", () => {
    const result = mapGoogleEventToCanonical(baseEvent({ iCalUID: undefined, id: "raw-id-1" }), ctx);
    expect(result.uid).toBe("raw-id-1@google.com");
  });

  it("throws when both id and iCalUID are missing", () => {
    expect(() =>
      mapGoogleEventToCanonical(baseEvent({ id: undefined, iCalUID: undefined }), ctx),
    ).toThrow(/no id/);
  });

  it("throws when start or end is missing", () => {
    expect(() => mapGoogleEventToCanonical(baseEvent({ start: undefined }), ctx)).toThrow();
  });
});
