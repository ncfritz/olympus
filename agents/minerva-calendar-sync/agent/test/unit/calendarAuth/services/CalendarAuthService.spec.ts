import { NotFoundException } from "@nestjs/common";
import { CalendarAuthService } from "../../../../src/calendarAuth/services/CalendarAuthService";
import { CalendarProviderRegistry } from "../../../../src/providers/services/CalendarProviderRegistry";
import { GoogleAuthStrategy } from "../../../../src/calendarAuth/strategies/GoogleAuthStrategy";
import { MicrosoftAuthStrategy } from "../../../../src/calendarAuth/strategies/MicrosoftAuthStrategy";
import type { GoogleCredentialStore } from "../../../../src/providers/google/GoogleCredentialStore";
import * as loopbackAuth from "../../../../src/providers/google/googleLoopbackAuth";
import type { MicrosoftCredentialStore } from "../../../../src/providers/microsoft/MicrosoftCredentialStore";
import { SyncedCalendarStore } from "../../../../src/store/syncedCalendarStore";
import { SyncConfigService } from "../../../../src/sync/services/SyncConfigService";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/providers/google/googleLoopbackAuth");

const mockedLoopback = vi.mocked(loopbackAuth);

// Fake credential stores, so nothing reads the real filesystem and picks
// up whatever has actually been authorized on this machine.
const mockedStore = {
  listAccountLabels: vi.fn(),
  tryLoad: vi.fn(),
  save: vi.fn(),
  createAuthorizedClient: vi.fn(),
  oauthClient: vi.fn(),
};
const mockedMicrosoftStore = {
  listAccountLabels: vi.fn(),
  tryLoad: vi.fn(),
  save: vi.fn(),
};

const CALENDARS = [
  {
    provider: "google" as const,
    accountLabel: "work",
    calendarId: "cal-1",
    source: "Work",
    enablePush: false,
  },
  {
    provider: "google" as const,
    accountLabel: "work",
    calendarId: "cal-2",
    source: "Work Shared",
    enablePush: false,
  },
  {
    provider: "google" as const,
    accountLabel: "personal",
    calendarId: "primary",
    source: "Personal",
    enablePush: false,
  },
];

function flushPromises(times = 3): Promise<void> {
  return times <= 0
    ? Promise.resolve()
    : new Promise((resolve) => setImmediate(resolve)).then(() =>
        flushPromises(times - 1),
      );
}

const seededCalendarStore: SyncedCalendarStore = {
  listAll: async () => CALENDARS,
  add: async () => {},
  remove: async () => {},
};

function makeService(
  providers: Partial<CalendarProviderRegistry> = {},
): CalendarAuthService {
  return new CalendarAuthService(
    new SyncConfigService(seededCalendarStore),
    providers as CalendarProviderRegistry,
    new GoogleAuthStrategy(mockedStore as unknown as GoogleCredentialStore),
    new MicrosoftAuthStrategy(
      mockedMicrosoftStore as unknown as MicrosoftCredentialStore,
      { clientId: "ms-client-id", tenantId: "common", credentialsDir: "" },
    ),
  );
}

describe("CalendarAuthService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedStore.oauthClient.mockReturnValue({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    // Only accounts with a configured calendar exist in these fixtures by
    // default — tests for the "connected but zero calendars yet" case
    // override this explicitly.
    mockedStore.listAccountLabels.mockReturnValue([]);
    mockedMicrosoftStore.listAccountLabels.mockReturnValue([]);
  });

  describe("listStatuses", () => {
    it("returns one entry per distinct google account label, with its sources", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);

      const statuses = await makeService().listStatuses();

      expect(statuses).toEqual([
        {
          accountLabel: "work",
          provider: "google",
          sources: ["Work", "Work Shared"],
          status: "not_connected",
        },
        {
          accountLabel: "personal",
          provider: "google",
          sources: ["Personal"],
          status: "not_connected",
        },
      ]);
    });

    it("keeps a google and a microsoft account distinct even when they share the exact same accountLabel", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);
      mockedMicrosoftStore.tryLoad.mockReturnValue(undefined);
      mockedMicrosoftStore.listAccountLabels.mockReturnValue(["work"]);

      const statuses = await makeService().listStatuses();

      const workEntries = statuses.filter((s) => s.accountLabel === "work");
      expect(workEntries).toEqual([
        {
          accountLabel: "work",
          provider: "google",
          sources: ["Work", "Work Shared"],
          status: "not_connected",
        },
        {
          accountLabel: "work",
          provider: "microsoft",
          sources: [],
          status: "not_connected",
        },
      ]);
    });
  });

  describe("isConnected", () => {
    it("is true when the provider's strategy has a stored credential for the account", () => {
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });

      expect(makeService().isConnected("work", "google")).toBe(true);
    });

    it("is false when there's no stored credential", () => {
      mockedStore.tryLoad.mockReturnValue(undefined);

      expect(makeService().isConnected("work", "google")).toBe(false);
    });

    it("checks the given provider's strategy specifically, not just any provider with that label", () => {
      // "work" has a google credential but not a microsoft one.
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      mockedMicrosoftStore.tryLoad.mockReturnValue(undefined);

      const service = makeService();
      expect(service.isConnected("work", "google")).toBe(true);
      expect(service.isConnected("work", "microsoft")).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("reports not_connected when no credential has ever been stored", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);

      const status = await makeService().getStatus("work");

      expect(status).toEqual({
        accountLabel: "work",
        provider: "google",
        sources: ["Work", "Work Shared"],
        status: "not_connected",
      });
    });

    it("reports ok with the access token's expiry when the refresh succeeds", async () => {
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      const expiryDate = Date.parse("2026-09-16T12:00:00.000Z");
      mockedStore.createAuthorizedClient.mockReturnValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "access-token" }),
        credentials: { expiry_date: expiryDate },
      } as never);

      const status = await makeService().getStatus("work");

      expect(status).toEqual({
        accountLabel: "work",
        provider: "google",
        sources: ["Work", "Work Shared"],
        status: "ok",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        obtainedAt: "2026-01-01T00:00:00.000Z",
        accessTokenExpiresAt: new Date(expiryDate).toISOString(),
      });
    });

    it("reports expired when Google rejects the refresh token", async () => {
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      mockedStore.createAuthorizedClient.mockReturnValue({
        getAccessToken: vi.fn().mockRejectedValue({
          response: {
            data: {
              error: "invalid_grant",
              error_description: "Token has been revoked",
            },
          },
        }),
        credentials: {},
      } as never);

      const status = await makeService().getStatus("work");

      expect(status.status).toBe("expired");
      expect(status.error).toBe("invalid_grant: Token has been revoked");
    });

    it("reports a generic error for anything else the refresh attempt throws", async () => {
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      mockedStore.createAuthorizedClient.mockReturnValue({
        getAccessToken: vi.fn().mockRejectedValue(new Error("network down")),
        credentials: {},
      } as never);

      const status = await makeService().getStatus("work");

      expect(status.status).toBe("error");
      expect(status.error).toBe("network down");
    });
  });

  describe("startReauth", () => {
    it("404s for an account label no configured calendar uses", async () => {
      await expect(makeService().startReauth("unknown")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns an authUrl immediately and reports reauth_pending until the flow completes", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);
      const client = {
        generateAuthUrl: vi
          .fn()
          .mockReturnValue("https://accounts.google.com/o/oauth2/auth?..."),
        getToken: vi.fn().mockResolvedValue({
          tokens: { refresh_token: "new-refresh-token", scope: "scope" },
        }),
      };
      mockedLoopback.createLoopbackClient.mockResolvedValue({
        client: client as never,
        redirectUri: "http://127.0.0.1:12345",
      });
      let resolveCode!: (code: string) => void;
      mockedLoopback.waitForAuthorizationCode.mockReturnValue(
        new Promise((resolve) => {
          resolveCode = resolve;
        }),
      );

      const service = makeService();
      const { authUrl } = await service.startReauth("work");
      expect(authUrl).toBe("https://accounts.google.com/o/oauth2/auth?...");
      expect((await service.getStatus("work")).status).toBe("reauth_pending");

      resolveCode("auth-code");
      await flushPromises();

      expect(client.getToken).toHaveBeenCalledWith("auth-code");
      expect(mockedStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accountLabel: "work",
          refreshToken: "new-refresh-token",
        }),
      );
    });

    it("returns the same in-flight authUrl instead of starting a second loopback listener", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);
      mockedLoopback.createLoopbackClient.mockResolvedValue({
        client: {
          generateAuthUrl: vi
            .fn()
            .mockReturnValue("https://accounts.google.com/first"),
        } as never,
        redirectUri: "http://127.0.0.1:12345",
      });
      mockedLoopback.waitForAuthorizationCode.mockReturnValue(
        new Promise(() => {}),
      );

      const service = makeService();
      const first = await service.startReauth("work");
      const second = await service.startReauth("work");

      expect(second.authUrl).toBe(first.authUrl);
      expect(mockedLoopback.createLoopbackClient).toHaveBeenCalledTimes(1);
    });

    it("surfaces the failure as status 'error' and allows retrying", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);
      mockedLoopback.createLoopbackClient.mockResolvedValue({
        client: {
          generateAuthUrl: vi
            .fn()
            .mockReturnValue("https://accounts.google.com/first"),
        } as never,
        redirectUri: "http://127.0.0.1:12345",
      });
      mockedLoopback.waitForAuthorizationCode.mockRejectedValue(
        new Error("Timed out waiting for the OAuth redirect"),
      );

      const service = makeService();
      await service.startReauth("work");
      await flushPromises();

      const status = await service.getStatus("work");
      expect(status.status).toBe("error");
      expect(status.error).toBe("Timed out waiting for the OAuth redirect");

      // Retrying clears the failed state back to pending.
      mockedLoopback.waitForAuthorizationCode.mockReturnValue(
        new Promise(() => {}),
      );
      await service.startReauth("work");
      expect((await service.getStatus("work")).status).toBe("reauth_pending");
    });
  });

  describe("listAvailableCalendars", () => {
    it("404s for an account label no configured calendar uses", async () => {
      await expect(
        makeService().listAvailableCalendars("unknown"),
      ).rejects.toThrow(NotFoundException);
    });

    it("404s when the account hasn't signed in yet", async () => {
      mockedStore.tryLoad.mockReturnValue(undefined);

      await expect(
        makeService().listAvailableCalendars("work"),
      ).rejects.toThrow(NotFoundException);
    });

    it("disambiguates via an explicit provider when the same label is connected under both", async () => {
      // "work" is a configured google account per CALENDARS; here it's also
      // a signed-in (but not yet configured) microsoft account under the
      // exact same label — an explicit provider must resolve to microsoft,
      // not fall through to google's ambiguous-fallback match.
      mockedStore.tryLoad.mockReturnValue(undefined);
      mockedMicrosoftStore.listAccountLabels.mockReturnValue(["work"]);
      mockedMicrosoftStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      const listCalendars = vi
        .fn()
        .mockResolvedValue([
          { id: "cal-ms-1", summary: "Work (Outlook)", primary: false },
        ]);
      const providers = {
        forAccount: vi.fn().mockReturnValue({ listCalendars }),
      };

      const calendars = await makeService(providers).listAvailableCalendars(
        "work",
        "microsoft",
      );

      expect(providers.forAccount).toHaveBeenCalledWith("work", "microsoft");
      expect(calendars).toEqual([
        { id: "cal-ms-1", summary: "Work (Outlook)", alreadySynced: false },
      ]);
    });

    it("lists Google's calendars for the account, flagging which are already synced", async () => {
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "work",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      const listCalendars = vi.fn().mockResolvedValue([
        { id: "cal-1", summary: "Work", primary: false },
        { id: "cal-4", summary: "Team Offsite", primary: false },
      ]);
      const providers = {
        forAccount: vi.fn().mockReturnValue({ listCalendars }),
      };

      const calendars =
        await makeService(providers).listAvailableCalendars("work");

      expect(providers.forAccount).toHaveBeenCalledWith("work", "google");
      expect(calendars).toEqual([
        { id: "cal-1", summary: "Work", alreadySynced: true },
        { id: "cal-4", summary: "Team Offsite", alreadySynced: false },
      ]);
    });

    it('treats Google\'s primary calendar as already synced when a "primary" alias is configured', async () => {
      mockedStore.tryLoad.mockReturnValue({
        accountLabel: "personal",
        refreshToken: "refresh-token",
        scope: "scope",
        obtainedAt: "2026-01-01T00:00:00.000Z",
      });
      // CALENDARS configures "personal" with calendarId "primary" — Google
      // itself reports that same calendar under the account's real email.
      const listCalendars = vi.fn().mockResolvedValue([
        {
          id: "personal@example.com",
          summary: "personal@example.com",
          primary: true,
        },
      ]);
      const providers = {
        forAccount: vi.fn().mockReturnValue({ listCalendars }),
      };

      const calendars =
        await makeService(providers).listAvailableCalendars("personal");

      expect(calendars).toEqual([
        {
          id: "personal@example.com",
          summary: "personal@example.com",
          alreadySynced: true,
        },
      ]);
    });
  });

  describe("account labels from stored credentials", () => {
    it("includes an account that has a stored credential but no configured calendar yet", async () => {
      mockedStore.listAccountLabels.mockReturnValue([
        "work",
        "personal",
        "brand-new@example.com",
      ]);
      mockedStore.tryLoad.mockReturnValue(undefined);

      const statuses = await makeService().listStatuses();

      expect(statuses.map((s) => s.accountLabel)).toEqual([
        "work",
        "personal",
        "brand-new@example.com",
      ]);
      expect(
        statuses.find((s) => s.accountLabel === "brand-new@example.com"),
      ).toEqual({
        accountLabel: "brand-new@example.com",
        provider: "google",
        sources: [],
        status: "not_connected",
      });
    });
  });

  describe("startNewAccountAuth / getNewAccountAuthStatus", () => {
    it("404s for an unknown transactionId", () => {
      expect(() => makeService().getNewAccountAuthStatus("unknown")).toThrow(
        NotFoundException,
      );
    });

    it("derives the account label from the signed-in email and saves the credential", async () => {
      mockedLoopback.createLoopbackClient.mockResolvedValue({
        client: {
          generateAuthUrl: vi
            .fn()
            .mockReturnValue("https://accounts.google.com/o/oauth2/auth?new"),
          getToken: vi.fn().mockResolvedValue({
            tokens: {
              refresh_token: "new-refresh-token",
              access_token: "new-access-token",
              scope: "scope",
            },
          }),
          getTokenInfo: vi.fn().mockResolvedValue({
            email: "brand-new@example.com",
            email_verified: true,
          }),
        } as never,
        redirectUri: "http://127.0.0.1:12345",
      });
      mockedLoopback.waitForAuthorizationCode.mockResolvedValue("auth-code");

      const service = makeService();
      const { transactionId, authUrl } =
        await service.startNewAccountAuth("google");
      expect(authUrl).toBe("https://accounts.google.com/o/oauth2/auth?new");
      expect(service.getNewAccountAuthStatus(transactionId)).toEqual({
        status: "pending",
      });

      await flushPromises();

      expect(mockedStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accountLabel: "brand-new@example.com",
          refreshToken: "new-refresh-token",
        }),
      );
      expect(service.getNewAccountAuthStatus(transactionId)).toEqual({
        status: "success",
        accountLabel: "brand-new@example.com",
      });
    });

    it("fails when Google doesn't return a verified email", async () => {
      mockedLoopback.createLoopbackClient.mockResolvedValue({
        client: {
          generateAuthUrl: vi
            .fn()
            .mockReturnValue("https://accounts.google.com/o/oauth2/auth?new"),
          getToken: vi.fn().mockResolvedValue({
            tokens: {
              refresh_token: "token",
              access_token: "access",
              scope: "scope",
            },
          }),
          getTokenInfo: vi.fn().mockResolvedValue({
            email: "unverified@example.com",
            email_verified: false,
          }),
        } as never,
        redirectUri: "http://127.0.0.1:12345",
      });
      mockedLoopback.waitForAuthorizationCode.mockResolvedValue("auth-code");

      const service = makeService();
      const { transactionId } = await service.startNewAccountAuth("google");
      await flushPromises();

      const status = service.getNewAccountAuthStatus(transactionId);
      expect(status.status).toBe("error");
      expect(status.error).toMatch(/verified email/);
      expect(mockedStore.save).not.toHaveBeenCalled();
    });
  });
});
