import type { Calendar, CalendarAccount } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  accountMeta,
  accountState,
  CALENDAR_COLORS,
  calendarColor,
  calendarsByAccount,
  calendarsReturnTo,
  claimConfirmPage,
  claimProblem,
  errorStatus,
  isEmailAddress,
  lastSyncedText,
  signInOutcome,
  sourceProblem,
  suggestSource,
  verificationText,
} from "../../src/utils/calendars";

const account = (
  overrides: Partial<CalendarAccount> = {},
): CalendarAccount => ({
  id: "a1",
  provider: "google",
  email: "neil@example.com",
  status: "ok",
  verification: "sign_in",
  verifiedTime: "2026-10-03T19:00:00Z",
  ...overrides,
});

const calendar = (overrides: Partial<Calendar> = {}): Calendar => ({
  calendarId: "neil@example.com",
  accountId: "a1",
  source: "personal",
  enabled: true,
  includedInBusy: true,
  synced: true,
  syncing: false,
  ...overrides,
});

describe("accountState", () => {
  it("is connected, with nothing to say, when the sign-in works", () => {
    expect(accountState("ok")).toMatchObject({
      label: "Connected",
      needsSignIn: false,
      canChangeCalendars: true,
    });
    expect(accountState("ok").explanation).toBeUndefined();
  });

  it.each(["expired", "reauth_pending", "error", "not_connected"] as const)(
    "asks for a sign-in when %s",
    (status) => {
      expect(accountState(status).needsSignIn).toBe(true);
    },
  );

  it("names the provider in what it says", () => {
    expect(accountState("expired").explanation?.("Microsoft")).toContain(
      "Microsoft stopped accepting",
    );
  });

  it("changes nothing when the status is unknown or there is no sign-in", () => {
    expect(accountState("unknown")).toMatchObject({
      label: "Status unavailable",
      needsSignIn: false,
      canChangeCalendars: false,
    });
    expect(accountState("not_connected").canChangeCalendars).toBe(false);
  });
});

describe("verificationText and accountMeta", () => {
  it.each([
    ["sign_in", "Your Olympus sign-in"],
    ["consent", "Connected from Olympus"],
    ["claim_email", "Claimed by email"],
    ["claim_consent", "Claimed by signing in"],
  ] as const)("says %s as %s", (method, text) => {
    expect(verificationText(method)).toBe(text);
  });

  it("puts the provider, the proof and the date together", () => {
    expect(
      accountMeta(account({ verifiedTime: "2026-10-03T12:00:00Z" })),
    ).toMatch(/^Google · Your Olympus sign-in, Oct 3, 2026$/);
  });
});

describe("signInOutcome", () => {
  it("is nothing for a page not reached from a sign-in", () => {
    expect(signInOutcome({})).toBeUndefined();
    expect(signInOutcome({ calendarAccount: "other" })).toBeUndefined();
  });

  it("offers the connected account's calendars", () => {
    expect(
      signInOutcome({ calendarAccount: "connected", accountId: "a1" }),
    ).toMatchObject({ type: "success", accountId: "a1" });
  });

  it.each([
    [{ calendarAccount: "cancelled" }, "info", "Sign-in cancelled."],
    [{ calendarAccount: "expired" }, "warning", "That sign-in took too long."],
    [
      { calendarAccount: "refused", reason: "owned" },
      "error",
      "That account belongs to another Olympus user.",
    ],
    [
      { calendarAccount: "refused", reason: "another-account" },
      "error",
      "You signed in as a different account.",
    ],
    [{ calendarAccount: "failed" }, "error", "Connecting didn't work."],
  ])("says %j", (query, type, title) => {
    expect(signInOutcome(query)).toMatchObject({ type, title });
  });

  it("reads the first of repeated keys", () => {
    expect(
      signInOutcome({ calendarAccount: ["cancelled", "connected"] })?.type,
    ).toBe("info");
  });
});

describe("calendarColor", () => {
  it("is the user's choice when they made one", () => {
    expect(calendarColor(calendar({ color: "#123456" }))).toBe("#123456");
  });

  it("is otherwise one of the palette, the same for the same label", () => {
    const color = calendarColor(calendar({ source: "family" }));
    expect(CALENDAR_COLORS).toContain(color);
    expect(calendarColor(calendar({ source: "family" }))).toBe(color);
  });
});

describe("calendarsByAccount", () => {
  it("puts each account's calendars beneath it, by label", () => {
    const groups = calendarsByAccount(
      [account(), account({ id: "a2", email: "work@example.com" })],
      [
        calendar({ source: "zeta" }),
        calendar({ source: "alpha" }),
        calendar({ accountId: "a2", source: "work" }),
        calendar({ accountId: "gone", source: "orphan" }),
      ],
    );
    expect(groups.map((g) => g.calendars.map((c) => c.source))).toEqual([
      ["alpha", "zeta"],
      ["work"],
    ]);
  });
});

describe("lastSyncedText", () => {
  const now = DateTime.fromISO("2026-10-04T12:00:00Z");
  const at = (minutesAgo: number) =>
    calendar({
      lastSyncedTime: now.minus({ minutes: minutesAgo }).toISO()!,
    });

  it.each([
    [0, "Just now"],
    [1, "1 minute ago"],
    [42, "42 minutes ago"],
    [60, "1 hour ago"],
    [300, "5 hours ago"],
  ])("says %i minutes ago as %s", (minutes, text) => {
    expect(lastSyncedText(at(minutes), now)).toBe(text);
  });

  it("gives the date after a day", () => {
    expect(lastSyncedText(at(3 * 24 * 60), now)).toBe("Oct 1, 2026");
  });

  it("says a sync is running, or has not run", () => {
    expect(lastSyncedText(calendar({ syncing: true }), now)).toBe("Syncing…");
    expect(lastSyncedText(calendar({ synced: false }), now)).toBe("Not yet");
  });
});

describe("suggestSource", () => {
  it.each([
    ["Book club", "book-club"],
    ["Holidays in United States", "holidays-in-united-states"],
    ["Café & Friends!", "cafe-friends"],
    ["  ---  ", "calendar"],
  ])("suggests %j as %j", (name, source) => {
    expect(suggestSource(name)).toBe(source);
  });

  it("keeps to 64 characters without a trailing dash", () => {
    const source = suggestSource(`${"a".repeat(63)} b`);
    expect(source.length).toBeLessThanOrEqual(64);
    expect(source.endsWith("-")).toBe(false);
  });
});

describe("sourceProblem", () => {
  it("accepts a fresh label", () => {
    expect(sourceProblem("book-club", ["personal"])).toBeUndefined();
  });

  it.each([
    ["", "Give it a label."],
    ["   ", "Give it a label."],
    ["x".repeat(65), "At most 64 characters."],
    ["personal", "Another calendar already uses “personal”."],
    [" personal ", "Another calendar already uses “personal”."],
  ])("refuses %j", (source, problem) => {
    expect(sourceProblem(source, ["personal"])).toBe(problem);
  });
});

describe("claims", () => {
  it.each(["neil@example.com", "  a.b+c@sub.example.co.uk "])(
    "accepts the address %j",
    (value) => {
      expect(isEmailAddress(value)).toBe(true);
    },
  );

  it.each(["", "neil", "neil@", "a b@example.com"])(
    "refuses the address %j",
    (value) => {
      expect(isEmailAddress(value)).toBe(false);
    },
  );

  it("builds this site's pages for the API", () => {
    expect(claimConfirmPage("https://olympus.example.com/")).toBe(
      "https://olympus.example.com/minerva/calendars/claim",
    );
    expect(calendarsReturnTo("https://olympus.example.com")).toBe(
      "https://olympus.example.com/minerva/calendars",
    );
  });

  it.each([
    [403, "This claim isn't yours", false],
    [404, "We don't know this link", false],
    [409, "The account has an owner", false],
    [410, "This link has expired", true],
    [500, "Something went wrong", false],
    [undefined, "Something went wrong", false],
  ])("says what a %s means", (status, title, claimAgain) => {
    const problem = claimProblem(status);
    expect(problem.title).toBe(title);
    expect(Boolean(problem.claimAgain)).toBe(claimAgain);
  });

  it("reads the status of a failed call", () => {
    expect(errorStatus({ response: { status: 410 } })).toBe(410);
    expect(errorStatus(new Error("network"))).toBeUndefined();
    expect(errorStatus(undefined)).toBeUndefined();
  });
});
