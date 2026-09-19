import { MeetingSource } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import { graphQlMeeting } from "../../../../fixtures/minerva";
import { toDomainObject } from "../../../../../src/minerva/meetings/converters/MeetingConverter";

describe("MeetingConverter.toDomainObject", () => {
  it("maps snake_case columns to the model", () => {
    const meeting = toDomainObject(graphQlMeeting());
    expect(meeting).toMatchObject({
      id: "meeting-1",
      uid: "uid-1",
      recurrenceId: "rec-1",
      subject: "Planning",
      occurrenceType: "Single",
      location: "Room 1",
      isDeleted: false,
      isCancelled: false,
      isAllDay: false,
      organizer: {
        email: "lead@example.com",
        alias: "lead",
        givenName: "Lee",
        surname: "Dar",
        type: "Required",
      },
      attendees: [
        {
          email: "ncfritz@example.com",
          givenName: "Neil",
          attendance: "Required",
          response: "Accepted",
        },
      ],
    });
    expect(meeting.startTime.toISOString()).toBe("2026-09-18T16:00:00.000Z");
    expect(meeting.endTime?.toISOString()).toBe("2026-09-18T17:30:00.000Z");
  });

  it("reports the duration in total minutes", () => {
    expect(
      toDomainObject(graphQlMeeting({ duration: "01:30:00" })).duration,
    ).toBe(90);
    expect(
      toDomainObject(graphQlMeeting({ duration: "00:45:00" })).duration,
    ).toBe(45);
  });

  it("defaults the source and allows a missing end time", () => {
    const meeting = toDomainObject(
      graphQlMeeting({
        source: undefined as never,
        end_time: undefined as never,
      }),
    );
    expect(meeting.source).toBe(MeetingSource.UNKNOWN);
    expect(meeting.endTime).toBeUndefined();
  });
});
