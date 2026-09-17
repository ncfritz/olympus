import { MicrosoftCalendarProvider } from "../../../../src/providers/microsoft/microsoft-calendar-provider";
import { MicrosoftAccessTokenProvider } from "../../../../src/providers/microsoft/microsoft-oauth";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function providerWithMockFetch(): { provider: MicrosoftCalendarProvider; fetchMock: jest.Mock } {
  const auth: MicrosoftAccessTokenProvider = { getAccessToken: jest.fn().mockResolvedValue("access-token") };
  const provider = new MicrosoftCalendarProvider(auth);
  const fetchMock = jest.fn();
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return { provider, fetchMock };
}

describe("MicrosoftCalendarProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("supportsPush returns true", () => {
    const { provider } = providerWithMockFetch();
    expect(provider.supportsPush()).toBe(true);
  });

  describe("watch", () => {
    it("creates a Graph subscription on the account's events resource and normalizes the response", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValue(
        jsonResponse({ id: "sub-1", resource: "me/events", expirationDateTime: "2026-01-01T00:00:00.000Z" }),
      );

      const channel = await provider.watch("primary", "https://example.com/webhooks/microsoft", "secret-token");

      expect(channel).toEqual({ id: "sub-1", resourceId: "me/events", expiration: "2026-01-01T00:00:00.000Z" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/subscriptions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
        }),
      );
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual(
        expect.objectContaining({
          changeType: "created,updated,deleted",
          notificationUrl: "https://example.com/webhooks/microsoft",
          resource: "me/events",
          clientState: "secret-token",
        }),
      );
    });

    it("scopes the subscription resource to a non-default calendar", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValue(
        jsonResponse({ id: "sub-2", resource: "me/calendars/cal-1/events", expirationDateTime: "2026-01-01T00:00:00.000Z" }),
      );

      await provider.watch("cal-1", "https://example.com/webhooks/microsoft", "token");

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.resource).toBe("me/calendars/cal-1/events");
    });

    it("throws when Graph returns an error response", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 400));

      await expect(provider.watch("primary", "https://example.com/webhooks/microsoft", "token")).rejects.toThrow(
        /failed \(400\)/,
      );
    });
  });

  describe("stopWatch", () => {
    it("deletes the subscription by id", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => undefined, text: async () => "" } as Response);

      await provider.stopWatch({ id: "sub-1", resourceId: "me/events", expiration: "2026-01-01T00:00:00.000Z" });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/subscriptions/sub-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("fullSync", () => {
    it("queries the delta endpoint without $top and yields the final page's deltaLink as the sync token", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ value: [{ id: "evt-1" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/events/delta?token=abc" }),
      );

      const batches = [];
      for await (const batch of provider.fullSync("primary")) {
        batches.push(batch);
      }

      expect(batches).toEqual([
        {
          events: [{ id: "evt-1" }],
          nextPageToken: undefined,
          nextSyncToken: "https://graph.microsoft.com/v1.0/me/events/delta?token=abc",
        },
      ]);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("https://graph.microsoft.com/v1.0/me/events/delta");
      expect(url).not.toContain("$top");
    });

    it("sends the page size via the Prefer header instead of $top", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValueOnce(jsonResponse({ value: [], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?token=x" }));

      for await (const batch of provider.fullSync("primary")) {
        void batch;
      }

      const [, init] = fetchMock.mock.calls[0];
      expect((init as RequestInit).headers).toEqual(
        expect.objectContaining({ Prefer: expect.stringContaining("odata.maxpagesize=250") }),
      );
    });

    it("follows @odata.nextLink across pages before yielding the deltaLink", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ value: [{ id: "evt-1" }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/next-page" }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ value: [{ id: "evt-2" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?token=final" }),
        );

      const batches = [];
      for await (const batch of provider.fullSync("primary")) {
        batches.push(batch);
      }

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toBe("https://graph.microsoft.com/v1.0/next-page");
      expect(batches[0].nextSyncToken).toBeUndefined();
      expect(batches[1].nextSyncToken).toBe("https://graph.microsoft.com/v1.0/delta?token=final");
    });
  });

  describe("incrementalSync", () => {
    it("GETs the stored deltaLink and returns accumulated events with the new deltaLink", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ value: [{ id: "evt-1" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?token=new" }),
      );

      const result = await provider.incrementalSync("primary", "https://graph.microsoft.com/v1.0/delta?token=old");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/delta?token=old",
        expect.objectContaining({}),
      );
      expect(result).toEqual({ events: [{ id: "evt-1" }], nextSyncToken: "https://graph.microsoft.com/v1.0/delta?token=new" });
    });

    it("throws SyncTokenExpiredError when Graph returns 410", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "resyncRequired" } }, 410));

      await expect(provider.incrementalSync("primary", "https://graph.microsoft.com/v1.0/delta?token=stale")).rejects.toThrow(
        /sync token/i,
      );
    });
  });

  describe("listCalendars", () => {
    it("maps Graph calendars and follows @odata.nextLink", async () => {
      const { provider, fetchMock } = providerWithMockFetch();
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({
            value: [{ id: "cal-1", name: "Calendar", isDefaultCalendar: true }],
            "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendars?page=2",
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ value: [{ id: "cal-2", name: "Shared" }] }));

      const calendars = await provider.listCalendars();

      expect(calendars).toEqual([
        { id: "cal-1", summary: "Calendar", primary: true },
        { id: "cal-2", summary: "Shared", primary: false },
      ]);
    });
  });
});
