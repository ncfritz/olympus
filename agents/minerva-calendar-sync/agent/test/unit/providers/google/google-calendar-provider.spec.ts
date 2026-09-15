import { OAuth2Client } from "google-auth-library";
import { GoogleCalendarProvider } from "../../../../src/providers/google/google-calendar-provider";

interface MockCalendarClient {
  events: { watch: jest.Mock };
  channels: { stop: jest.Mock };
}

function providerWithMockCalendar(): { provider: GoogleCalendarProvider; calendar: MockCalendarClient } {
  const provider = new GoogleCalendarProvider(new OAuth2Client("id", "secret"));
  const calendar: MockCalendarClient = {
    events: { watch: jest.fn() },
    channels: { stop: jest.fn() },
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
        data: { id: "chan-1", resourceId: "res-1", expiration: "1893456000000" },
      });

      const channel = await provider.watch("primary", "https://example.com/webhooks/google", "secret-token");

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

      await expect(provider.watch("primary", "https://example.com/webhooks/google", "token")).rejects.toThrow(
        /incomplete channel/,
      );
    });
  });

  describe("stopWatch", () => {
    it("stops the channel by id and resourceId", async () => {
      const { provider, calendar } = providerWithMockCalendar();
      calendar.channels.stop.mockResolvedValue({});

      await provider.stopWatch({ id: "chan-1", resourceId: "res-1", expiration: "2026-01-01T00:00:00.000Z" });

      expect(calendar.channels.stop).toHaveBeenCalledWith({
        requestBody: { id: "chan-1", resourceId: "res-1" },
      });
    });
  });
});
