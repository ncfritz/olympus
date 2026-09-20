import { OAuth2Client } from "google-auth-library";
import { GoogleCalendarProvider } from "../../../../src/providers/google/google-calendar-provider";
import { type Mock, describe, expect, it, vi } from "vitest";

interface MockCalendarClient {
  events: { watch: Mock; list: Mock; get: Mock };
  channels: { stop: Mock };
}

function providerWithMockCalendar(): {
  provider: GoogleCalendarProvider;
  calendar: MockCalendarClient;
} {
  const provider = new GoogleCalendarProvider(new OAuth2Client("id", "secret"));
  const calendar: MockCalendarClient = {
    events: { watch: vi.fn(), list: vi.fn(), get: vi.fn() },
    channels: { stop: vi.fn() },
  };
  // GoogleCalendarProvider builds its own googleapis client internally; swapping
  // the private field for a mock avoids a real network-backed constructor param
  // just for testability.
  (provider as unknown as { calendar: MockCalendarClient }).calendar = calendar;
  return { provider, calendar };
}

describe("GoogleCalendarProvider", () => {
  it("supportsPush returns true", () => {
    const { provider } = providerWithMockCalendar();
    expect(provider.supportsPush()).toBe(true);
  });

  describe("watch", () => {
    it("registers a channel with the given webhook URL and token, and normalizes the response", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.events.watch.mockResolvedValue({
        data: {
          id: "chan-1",
          resourceId: "res-1",
          expiration: "1893456000000",
        },
      });

      const channel = await provider.watch(
        "primary",
        "https://example.com/webhooks/google",
        "secret-token",
      );

      expect(channel).toEqual({
        id: "chan-1",
        resourceId: "res-1",
        expiration: new Date(1893456000000).toISOString(),
      });
      expect(calendar.events.watch).toHaveBeenCalledWith({
        calendarId: "primary",
        requestBody: expect.objectContaining({
          type: "web_hook",
          address: "https://example.com/webhooks/google",
          token: "secret-token",
        }),
      });
    });

    it("throws when Google returns an incomplete channel", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.events.watch.mockResolvedValue({ data: { id: "chan-1" } });

      await expect(
        provider.watch(
          "primary",
          "https://example.com/webhooks/google",
          "token",
        ),
      ).rejects.toThrow(/incomplete channel/);
    });
  });

  describe("stopWatch", () => {
    it("stops the channel by id and resourceId", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.channels.stop.mockResolvedValue({});

      await provider.stopWatch({
        id: "chan-1",
        resourceId: "res-1",
        expiration: "2026-01-01T00:00:00.000Z",
      });

      expect(calendar.channels.stop).toHaveBeenCalledWith({
        requestBody: { id: "chan-1", resourceId: "res-1" },
      });
    });
  });

  describe("fullSync", () => {
    it("expands recurring series into occurrences, bounded to the given window", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.events.list.mockResolvedValue({
        data: { items: [{ id: "evt-1" }] },
      });
      const window = {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-07-01T00:00:00.000Z",
      };

      const batches = [];
      for await (const batch of provider.fullSync("primary", window))
        batches.push(batch);

      expect(batches).toEqual([
        {
          events: [{ id: "evt-1" }],
          nextPageToken: undefined,
          nextSyncToken: undefined,
        },
      ]);
      expect(calendar.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: "primary",
          singleEvents: true,
          timeMin: window.start,
          timeMax: window.end,
        }),
      );
      // orderBy is deliberately never sent alongside singleEvents here — see
      // fullSync's doc comment: combining them silently drops nextSyncToken.
      expect(calendar.events.list).not.toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: expect.anything() }),
      );
    });
  });

  describe("normalizeEvent", () => {
    it("resolves a plain occurrence's recurrenceRule from its series master, caching across occurrences of the same series", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.events.get.mockResolvedValue({
        data: { recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"] },
      });
      const occurrence = (uid: string) => ({
        id: uid,
        iCalUID: `${uid}@google.com`,
        recurringEventId: "master-1",
        summary: "Standup",
        status: "confirmed",
        start: { dateTime: "2026-01-05T10:00:00-05:00" },
        end: { dateTime: "2026-01-05T10:30:00-05:00" },
      });

      const first = await provider.normalizeEvent(occurrence("occ-1"), {
        source: "work",
        calendarId: "primary",
      });
      const second = await provider.normalizeEvent(occurrence("occ-2"), {
        source: "work",
        calendarId: "primary",
      });

      expect(first.recurrenceRule).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO");
      expect(second.recurrenceRule).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO");
      // One lookup for the whole series, not one per occurrence.
      expect(calendar.events.get).toHaveBeenCalledTimes(1);
      expect(calendar.events.get).toHaveBeenCalledWith({
        calendarId: "primary",
        eventId: "master-1",
      });
    });

    it("reads recurrenceRule directly off the event when it's a series master itself, without a lookup", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      const master = {
        id: "master-1",
        iCalUID: "master-1@google.com",
        recurrence: ["RRULE:FREQ=DAILY"],
        summary: "Standup",
        status: "confirmed",
        start: { dateTime: "2026-01-05T10:00:00-05:00" },
        end: { dateTime: "2026-01-05T10:30:00-05:00" },
      };

      const result = await provider.normalizeEvent(master, {
        source: "work",
        calendarId: "primary",
      });

      expect(result.recurrenceRule).toBe("RRULE:FREQ=DAILY");
      expect(calendar.events.get).not.toHaveBeenCalled();
    });

    it("resolves to null, without failing, when the master lookup errors", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.events.get.mockRejectedValue(new Error("boom"));
      const occurrence = {
        id: "occ-1",
        iCalUID: "occ-1@google.com",
        recurringEventId: "master-1",
        summary: "Standup",
        status: "confirmed",
        start: { dateTime: "2026-01-05T10:00:00-05:00" },
        end: { dateTime: "2026-01-05T10:30:00-05:00" },
      };

      const result = await provider.normalizeEvent(occurrence, {
        source: "work",
        calendarId: "primary",
      });

      expect(result.recurrenceRule).toBeNull();
    });
  });
});
