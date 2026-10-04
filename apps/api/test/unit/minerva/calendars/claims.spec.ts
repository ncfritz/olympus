import { describe, expect, it } from "vitest";
import {
  CLAIM_LIFETIME_MS,
  claimLink,
  claimState,
  isEmailAddress,
  likeExactly,
  newClaimToken,
} from "../../../../src/minerva/calendars/utils/claims";
import { hashState } from "../../../../src/minerva/calendars/utils/signIns";

describe("newClaimToken", () => {
  it("keeps only the token's hash, and is new every time", () => {
    const a = newClaimToken();
    const b = newClaimToken();
    expect(a.hash).toBe(hashState(a.value));
    expect(a.hash).not.toContain(a.value);
    expect(a.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.value).not.toBe(b.value);
  });
});

describe("claimLink", () => {
  it("adds the token to the confirm page, keeping its query", () => {
    expect(
      claimLink("https://olympus.example.com/minerva/claim?tab=a", "t0k-en"),
    ).toBe("https://olympus.example.com/minerva/claim?tab=a&token=t0k-en");
  });
});

describe("claimState", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const claim = (overrides = {}) => ({
    expiresTime: "2026-10-05T12:00:00Z",
    confirmedTime: null,
    cancelledTime: null,
    ...overrides,
  });

  it("is open until it expires", () => {
    expect(claimState(claim(), now)).toBe("open");
    expect(
      claimState(claim({ expiresTime: "2026-10-04T12:00:00Z" }), now),
    ).toBe("expired");
  });

  it("is confirmed or cancelled for good, expired or not", () => {
    expect(
      claimState(
        claim({
          confirmedTime: "2026-10-04T11:00:00Z",
          expiresTime: "2026-10-01T00:00:00Z",
        }),
        now,
      ),
    ).toBe("confirmed");
    expect(
      claimState(claim({ cancelledTime: "2026-10-04T11:00:00Z" }), now),
    ).toBe("cancelled");
  });

  it("lives a day", () => {
    expect(CLAIM_LIFETIME_MS).toBe(86_400_000);
  });
});

describe("isEmailAddress", () => {
  it.each(["neil@example.com", "a.b+c@sub.example.co.uk"])(
    "accepts %s",
    (value) => {
      expect(isEmailAddress(value)).toBe(true);
    },
  );

  it.each([
    "",
    "neil",
    "neil@",
    "@example.com",
    "a b@example.com",
    "a@b@c",
    `${"x".repeat(250)}@e.co`,
  ])("refuses %j", (value) => {
    expect(isEmailAddress(value)).toBe(false);
  });
});

describe("likeExactly", () => {
  it("escapes what _ilike would read as a pattern", () => {
    expect(likeExactly("first_last%x\\y@example.com")).toBe(
      "first\\_last\\%x\\\\y@example.com",
    );
  });

  it("leaves an ordinary address alone", () => {
    expect(likeExactly("neil@example.com")).toBe("neil@example.com");
  });
});
