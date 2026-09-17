import {
  isMicrosoftRemoval,
  mapMicrosoftEventToCanonical,
  MicrosoftGraphEvent,
  resolveMicrosoftRemoval,
} from "../../../../src/providers/microsoft/microsoft-event-mapper";

function baseEvent(overrides: Partial<MicrosoftGraphEvent> = {}): MicrosoftGraphEvent {
  return {
    id: "graph-id-1",
    subject: "Team sync",
    isCancelled: false,
    start: { dateTime: "2026-01-05T15:00:00.0000000" },
    end: { dateTime: "2026-01-05T15:30:00.0000000" },
    ...overrides,
  };
}

const ctx = { source: "work-o365" };

describe("mapMicrosoftEventToCanonical", () => {
  it("maps the common fields, using Graph's own id as uid", () => {
    const result = mapMicrosoftEventToCanonical(baseEvent(), ctx);

    expect(result.id).toBe("work-o365:graph-id-1");
    expect(result.uid).toBe("graph-id-1");
    expect(result.source).toBe("work-o365");
    expect(result.subject).toBe("Team sync");
    expect(result.startTime).toBe("2026-01-05T15:00:00.000Z");
    expect(result.endTime).toBe("2026-01-05T15:30:00.000Z");
    expect(result.duration).toBe(30);
    expect(result.allDay).toBe(false);
  });

  it("defaults a missing subject to '(No title)'", () => {
    const result = mapMicrosoftEventToCanonical(baseEvent({ subject: undefined }), ctx);
    expect(result.subject).toBe("(No title)");
  });

  it("maps an all-day event, taking just the date portion of start/end", () => {
    const result = mapMicrosoftEventToCanonical(
      baseEvent({
        isAllDay: true,
        start: { dateTime: "2026-01-05T00:00:00.0000000" },
        end: { dateTime: "2026-01-06T00:00:00.0000000" },
      }),
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
    ["normal", "normal"],
    [undefined, "normal"],
    ["not-a-real-value", "normal"],
  ] as const)("maps Graph sensitivity %s to %s", (sensitivity, expected) => {
    const result = mapMicrosoftEventToCanonical(baseEvent({ sensitivity }), ctx);
    expect(result.sensitivity).toBe(expected);
  });

  it.each([
    ["low", "low"],
    ["high", "high"],
    [undefined, "normal"],
    ["not-a-real-value", "normal"],
  ] as const)("maps Graph importance %s to %s", (importance, expected) => {
    const result = mapMicrosoftEventToCanonical(baseEvent({ importance }), ctx);
    expect(result.importance).toBe(expected);
  });

  it("classifies occurrenceType from Graph's type field directly", () => {
    expect(mapMicrosoftEventToCanonical(baseEvent({ type: "singleInstance" }), ctx).occurrenceType).toBe("single");
    expect(mapMicrosoftEventToCanonical(baseEvent({ type: "occurrence" }), ctx).occurrenceType).toBe("occurrence");
    expect(mapMicrosoftEventToCanonical(baseEvent({ type: "exception" }), ctx).occurrenceType).toBe("occurrence");
    expect(mapMicrosoftEventToCanonical(baseEvent({ type: "seriesMaster" }), ctx).occurrenceType).toBe(
      "series_master",
    );
  });

  it("carries seriesMasterId through as recurrenceId", () => {
    const result = mapMicrosoftEventToCanonical(baseEvent({ seriesMasterId: "master-1" }), ctx);
    expect(result.recurrenceId).toBe("master-1");
  });

  it("classifies type from attendee presence", () => {
    expect(mapMicrosoftEventToCanonical(baseEvent(), ctx).type).toBe("appointment");
    expect(
      mapMicrosoftEventToCanonical(baseEvent({ attendees: [{ emailAddress: { address: "a@x.com" } }] }), ctx).type,
    ).toBe("meeting");
  });

  it("reads reminder directly from isReminderOn", () => {
    expect(mapMicrosoftEventToCanonical(baseEvent({ isReminderOn: false }), ctx).reminder).toBe(false);
    expect(mapMicrosoftEventToCanonical(baseEvent({ isReminderOn: true }), ctx).reminder).toBe(true);
  });

  it("maps response: isOrganizer takes priority over responseStatus", () => {
    const result = mapMicrosoftEventToCanonical(
      baseEvent({ isOrganizer: true, responseStatus: { response: "declined" } }),
      ctx,
    );
    expect(result.response).toBe("organizer");
  });

  it.each([
    ["accepted", "accepted"],
    ["declined", "declined"],
    ["tentativelyAccepted", "tentative"],
    ["notResponded", "needs_action"],
  ] as const)("maps Graph responseStatus.response %s to %s", (response, expected) => {
    const result = mapMicrosoftEventToCanonical(baseEvent({ isOrganizer: false, responseStatus: { response } }), ctx);
    expect(result.response).toBe(expected);
  });

  it("defaults response to accepted with no organizer flag and no tracked response", () => {
    expect(mapMicrosoftEventToCanonical(baseEvent(), ctx).response).toBe("accepted");
  });

  it.each([
    ["free", "free"],
    ["tentative", "tentative"],
    ["busy", "busy"],
    ["oof", "out_of_office"],
    ["workingElsewhere", "working_elsewhere"],
    ["unknown", "busy"],
    [undefined, "busy"],
  ] as const)("maps Graph showAs %s to free/busy status %s", (showAs, expected) => {
    const result = mapMicrosoftEventToCanonical(baseEvent({ showAs }), ctx);
    expect(result.status).toBe(expected);
  });

  it("maps cancelled from Graph's isCancelled field", () => {
    expect(mapMicrosoftEventToCanonical(baseEvent({ isCancelled: true }), ctx).cancelled).toBe(true);
  });

  it("throws when start or end is missing", () => {
    expect(() => mapMicrosoftEventToCanonical(baseEvent({ start: undefined }), ctx)).toThrow();
  });
});

describe("isMicrosoftRemoval / resolveMicrosoftRemoval", () => {
  it("recognizes a delta removal stub by its @removed marker", () => {
    expect(isMicrosoftRemoval(baseEvent())).toBe(false);
    expect(isMicrosoftRemoval({ id: "gone-1", "@removed": { reason: "deleted" } })).toBe(true);
  });

  it("resolves uid from Graph's own id, with no heuristic needed", () => {
    const tombstone = resolveMicrosoftRemoval({ id: "gone-1", "@removed": { reason: "deleted" } });
    expect(tombstone.uid).toBe("gone-1");
    expect(tombstone.isOccurrence).toBe(false);
  });

  it("flags an occurrence removal when seriesMasterId survives onto the stub", () => {
    const tombstone = resolveMicrosoftRemoval({
      id: "gone-2",
      seriesMasterId: "master-1",
      "@removed": { reason: "deleted" },
    });
    expect(tombstone.isOccurrence).toBe(true);
  });
});
