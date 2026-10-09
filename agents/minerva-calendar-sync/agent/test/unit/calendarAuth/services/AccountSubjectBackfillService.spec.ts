import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSubjectBackfillService } from "../../../../src/calendarAuth/services/AccountSubjectBackfillService";
import type { GoogleAuthStrategy } from "../../../../src/calendarAuth/strategies/GoogleAuthStrategy";
import type { MicrosoftAuthStrategy } from "../../../../src/calendarAuth/strategies/MicrosoftAuthStrategy";

const strategy = (provider: string) => ({
  provider,
  listStoredAccountLabels: vi.fn(),
  tryLoadCredential: vi.fn(),
  recordSubject: vi.fn(),
  errorMessage: vi.fn((error: unknown) => String(error)),
});

describe("AccountSubjectBackfillService", () => {
  let google: ReturnType<typeof strategy>;
  let microsoft: ReturnType<typeof strategy>;
  let service: AccountSubjectBackfillService;

  beforeEach(() => {
    google = strategy("google");
    microsoft = strategy("microsoft");
    service = new AccountSubjectBackfillService(
      google as unknown as GoogleAuthStrategy,
      microsoft as unknown as MicrosoftAuthStrategy,
    );
  });

  it("records the subject of every account that lacks one, and only those", async () => {
    google.listStoredAccountLabels.mockReturnValue(["has@x", "lacks@x"]);
    google.tryLoadCredential.mockImplementation((label: string) =>
      label === "has@x" ? { subject: "g-1" } : { scope: "s" },
    );
    google.recordSubject.mockResolvedValue("g-2");
    microsoft.listStoredAccountLabels.mockReturnValue(["ms@x"]);
    microsoft.tryLoadCredential.mockReturnValue({ scope: "s" });
    microsoft.recordSubject.mockResolvedValue("tid:oid");

    await service.backfill();

    expect(google.recordSubject).toHaveBeenCalledTimes(1);
    expect(google.recordSubject).toHaveBeenCalledWith("lacks@x");
    expect(microsoft.recordSubject).toHaveBeenCalledWith("ms@x");
  });

  it("carries on past an account whose provider fails or gives no subject", async () => {
    google.listStoredAccountLabels.mockReturnValue(["broken@x", "next@x"]);
    google.tryLoadCredential.mockReturnValue({ scope: "s" });
    google.recordSubject
      .mockRejectedValueOnce(new Error("invalid_grant"))
      .mockResolvedValueOnce(undefined);
    microsoft.listStoredAccountLabels.mockReturnValue([]);

    await expect(service.backfill()).resolves.toBeUndefined();

    expect(google.recordSubject).toHaveBeenCalledTimes(2);
  });
});
