import { describe, expect, it } from "vitest";
import { organizerOf } from "../../src/utils/meetings";

describe("organizerOf", () => {
  it("names a known organizer, with their photo", () => {
    expect(
      organizerOf({
        organizer: {
          email: "lee@example.com",
          alias: "lee",
          givenName: "Lee",
          surname: "Dar",
        },
        organizerEmail: "lee@example.com",
      }),
    ).toEqual({
      name: "Lee Dar",
      email: "lee@example.com",
      avatar: "https://cdn.internal.ncfritz.net/amzn/avatar/lee.jpg",
    });
  });

  it("falls back to the address of a synced meeting's organizer", () => {
    expect(organizerOf({ organizerEmail: "someone@example.com" })).toEqual({
      name: "someone@example.com",
      email: "someone@example.com",
      avatar: undefined,
    });
  });

  it("says so when a meeting names no organizer", () => {
    expect(organizerOf({})).toEqual({
      name: "Unknown organizer",
      email: undefined,
      avatar: undefined,
    });
  });
});
