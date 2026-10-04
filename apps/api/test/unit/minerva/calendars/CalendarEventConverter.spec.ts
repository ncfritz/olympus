import type { CalendarEventMessage } from "@ncfritz/olympus-messages";
import { describe, expect, it } from "vitest";
import {
  accountOf,
  toMeetingFields,
} from "../../../../src/minerva/calendars/converters/CalendarEventConverter";
import { actionOf } from "../../../../src/minerva/calendars/messaging";
import { calendarEvent } from "../../../fixtures/calendarEvents";

describe("toMeetingFields", () => {
  it("maps an event onto the meetings columns, in the table's vocabulary", () => {
    expect(toMeetingFields(calendarEvent())).toEqual({
      fields: {
        id: "neil:abc123@google.com",
        subject: "Planning",
        sensitivity: "Normal",
        importance: "Normal",
        occurrence_type: "Single",
        type: "Meeting",
        reminder: true,
        response: "Accepted",
        start_time: "2026-10-05T16:00:00.000Z",
        end_time: "2026-10-05T17:30:00.000Z",
        duration: 90,
        all_day: false,
        status: "Busy",
        location: "Room 1",
        cancelled: false,
        organizer_email: "lead@example.com",
        deleted: false,
        uid: "abc123@google.com",
        recurrence_id: null,
        source: "neil",
      },
    });
  });

  it.each([
    ["sensitivity", "confidential", "sensitivity", "Confidential"],
    ["importance", "high", "importance", "High"],
    ["occurrenceType", "series_master", "occurrence_type", "RecurringMaster"],
    ["occurrenceType", "occurrence", "occurrence_type", "Occurrence"],
    ["type", "appointment", "type", "Appointment"],
    ["response", "organizer", "response", "Organizer"],
    ["response", "declined", "response", "Declined"],
    ["response", "needs_action", "response", "NotResponded"],
    ["status", "out_of_office", "status", "OOF"],
    ["status", "working_elsewhere", "status", "WorkingElsewhere"],
    ["status", "free", "status", "Free"],
  ] as const)("maps %s %s", (key, value, column, expected) => {
    const result = toMeetingFields(calendarEvent({ [key]: value }));
    expect("fields" in result && result.fields[column]).toBe(expected);
  });

  it("keeps a delete's snapshot, marked deleted", () => {
    const result = toMeetingFields(calendarEvent({ deleted: true }));
    expect("fields" in result && result.fields.deleted).toBe(true);
  });

  it("normalizes times with an offset to UTC", () => {
    const result = toMeetingFields(
      calendarEvent({ startTime: "2026-10-05T09:00:00-07:00" }),
    );
    expect("fields" in result && result.fields.start_time).toBe(
      "2026-10-05T16:00:00.000Z",
    );
  });

  it("allows an event without a title", () => {
    const result = toMeetingFields(
      calendarEvent({ subject: undefined as unknown as string }),
    );
    expect("fields" in result && result.fields.subject).toBe("");
  });

  it.each([
    ["no id", { id: "" }, "id is required"],
    ["no uid", { uid: undefined }, "uid is required"],
    ["no source", { source: "" }, "source is required"],
    ["a start that is not a time", { startTime: "soon" }, "startTime must be"],
    ["an unknown status", { status: "away" }, "status must be one of"],
    ["a duration that is not a number", { duration: "90" }, "duration must"],
    ["a negative duration", { duration: -5 }, "duration must"],
    ["a flag that is not a boolean", { allDay: "no" }, "allDay must"],
    ["a location that is not text", { location: 4 }, "location must be text"],
  ])("refuses %s", (_, overrides, problem) => {
    const result = toMeetingFields(
      calendarEvent(overrides as Partial<CalendarEventMessage>),
    );
    expect(result).toEqual({
      problems: [expect.stringContaining(problem)],
    });
  });

  it("refuses something that is not an event at all", () => {
    expect(toMeetingFields("hello")).toEqual({
      problems: ["the message is not an object"],
    });
    expect(toMeetingFields(null)).toEqual({
      problems: ["the message is not an object"],
    });
  });
});

describe("accountOf", () => {
  it("reads the event's account", () => {
    expect(accountOf(calendarEvent())).toEqual({
      provider: "google",
      subject: "1098",
    });
  });

  it.each([
    ["no account", { account: undefined }],
    ["an account without a subject", { account: { provider: "google" } }],
    ["an empty subject", { account: { provider: "google", subject: "" } }],
  ])("is undefined for %s", (_, overrides) => {
    expect(
      accountOf(calendarEvent(overrides as Partial<CalendarEventMessage>)),
    ).toBeUndefined();
  });

  it("is undefined for something that is not an event", () => {
    expect(accountOf(null)).toBeUndefined();
  });
});

describe("actionOf", () => {
  it.each([
    ["event.upsert", "upsert"],
    ["event.delete", "delete"],
    ["event.backfill", "backfill"],
  ])("reads %s", (key, action) => {
    expect(actionOf(key)).toBe(action);
  });

  it.each(["event.rename", "upsert", "events.upsert", undefined])(
    "knows no action for %s",
    (key) => {
      expect(actionOf(key)).toBeUndefined();
    },
  );
});
