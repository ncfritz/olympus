import { describe, expect, it, vi } from "vitest";
import { EventAccountResolver } from "../../../../src/outbox/services/EventAccountResolver";
import type { GoogleCredentialStore } from "../../../../src/providers/google/GoogleCredentialStore";
import type { MicrosoftCredentialStore } from "../../../../src/providers/microsoft/MicrosoftCredentialStore";
import type { SyncConfigService } from "../../../../src/sync/services/SyncConfigService";

const calendars = [
  {
    provider: "google" as const,
    accountLabel: "me@example.com",
    calendarId: "primary",
    source: "Personal",
    enablePush: false,
  },
  {
    provider: "microsoft" as const,
    accountLabel: "me@work.example",
    calendarId: "primary",
    source: "Work",
    enablePush: false,
  },
  {
    provider: "google" as const,
    accountLabel: "old@example.com",
    calendarId: "old",
    source: "Old",
    enablePush: false,
  },
];

const resolver = () => {
  const google = {
    tryLoad: vi.fn((label: string) =>
      label === "me@example.com" ? { subject: "google-sub" } : { scope: "s" },
    ),
  };
  const microsoft = {
    tryLoad: vi.fn(() => ({ subject: "tid:oid" })),
  };
  return new EventAccountResolver(
    { getAll: async () => calendars } as unknown as SyncConfigService,
    google as unknown as GoogleCredentialStore,
    microsoft as unknown as MicrosoftCredentialStore,
  );
};

describe("EventAccountResolver", () => {
  it.each([
    ["Personal", { provider: "google", subject: "google-sub" }],
    ["Work", { provider: "microsoft", subject: "tid:oid" }],
  ])("names %s's account by provider and subject", async (source, account) => {
    await expect(resolver().forSource(source)).resolves.toEqual(account);
  });

  it("names no account when its subject is not recorded", async () => {
    await expect(resolver().forSource("Old")).resolves.toBeUndefined();
  });

  it("names no account for a calendar no longer synced", async () => {
    await expect(resolver().forSource("Gone")).resolves.toBeUndefined();
  });
});
