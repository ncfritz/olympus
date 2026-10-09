import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A synced meeting's ID holds characters a path must encode (a calendar's
 * ":" and an iCalendar UID's "@"). The SDK encodes path parameters itself,
 * so the clients pass IDs as they are: encoded twice, the API is asked for
 * a meeting that isn't there (a 404).
 */

const sent = vi.hoisted(() => [] as { url: string }[]);

vi.mock("@ncfritz/olympus-sdk/minerva", async (importActual) => {
  const actual =
    await importActual<typeof import("@ncfritz/olympus-sdk/minerva")>();
  // Each call records the URL the SDK would request, built by its client.
  const recording =
    (url: string) => async (options: { path: Record<string, unknown> }) => {
      sent.push({ url: actual.client.buildUrl({ ...options, url }) });
      return { data: {} };
    };
  return {
    ...actual,
    describeCalendarItem: recording("/minerva/meeting/{meetingId}"),
    getNextCalendarItemOccurrence: recording(
      "/minerva/meeting/{meetingId}/next",
    ),
    listPreviousCalendarItemOccurrences: recording(
      "/minerva/meeting/{meetingId}/previous",
    ),
    getNotesForEntity: recording(
      "/minerva/notes/entity/{entityType}/{entityId}",
    ),
  };
});

import meetingsApi from "../../src/api/meetingsApi";
import notesApi from "../../src/api/notestApi";

const ID =
  "ncfritz-ncfritz-net:_68q3echg6sp3aba36or42b9k650jiba270pjaba3851jehhp71144gpn68_20261014T030000Z@google.com";
const ENCODED =
  "ncfritz-ncfritz-net%3A_68q3echg6sp3aba36or42b9k650jiba270pjaba3851jehhp71144gpn68_20261014T030000Z%40google.com";

describe("a synced meeting's ID in a request", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("is encoded once for the meeting and its series", async () => {
    await meetingsApi.getMeeting(ID);
    await meetingsApi.getNextMeetingInSeries(ID);
    await meetingsApi.getPreviousMeetingInSeries(ID);

    expect(sent.map((s) => s.url)).toEqual([
      `/api/v1/minerva/meeting/${ENCODED}`,
      `/api/v1/minerva/meeting/${ENCODED}/next`,
      `/api/v1/minerva/meeting/${ENCODED}/previous?limit=5`,
    ]);
  });

  it("is encoded once for the meeting's notes", async () => {
    await notesApi.getNotesForEntity("meeting", ID);

    expect(sent.map((s) => s.url)).toEqual([
      `/api/v1/minerva/notes/entity/meeting/${ENCODED}`,
    ]);
  });
});
