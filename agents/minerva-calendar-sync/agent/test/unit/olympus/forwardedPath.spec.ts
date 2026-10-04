import { describe, expect, it } from "vitest";
import { forwardedPath } from "../../../src/olympus/services/OlympusForwardingService";

describe("forwardedPath", () => {
  it.each([
    ["GET", "/olympus/v1/minerva/availability?start=a&end=b"],
    ["GET", "/olympus/v1/minerva/availability-blocks?start=a&end=b"],
    ["POST", "/olympus/v1/minerva/availability-blocks"],
    ["PUT", "/olympus/v1/minerva/availability-block/b-1"],
    ["DELETE", "/olympus/v1/minerva/availability-block/b-1"],
    ["GET", "/olympus/v1/minerva/meeting-availabilities?meetingIds=a,b"],
    ["PUT", "/olympus/v1/minerva/meeting/work:abc@google.com/availability"],
    ["DELETE", "/olympus/v1/minerva/meeting/ms:AAMk%2FAB%3D/availability"],
  ])("forwards %s %s as it is", (method, url) => {
    expect(forwardedPath(method, url)).toBe(url.slice("/olympus".length));
  });

  it.each([
    ["an operation it does not forward", "GET", "/olympus/v1/minerva/meetings"],
    [
      "a method it does not forward",
      "DELETE",
      "/olympus/v1/minerva/availability",
    ],
    ["another prefix", "GET", "/v1/minerva/availability"],
    [
      "a dot segment",
      "GET",
      "/olympus/v1/minerva/availability-block/b-1/../../meetings",
    ],
    [
      "an encoded dot segment",
      "GET",
      "/olympus/v1/minerva/availability-block/%2e%2e",
    ],
    [
      "backslashes the parser reads as slashes",
      "DELETE",
      "/olympus/v1/minerva/availability-block/x\\..\\..\\..\\auth\\sessions",
    ],
    ["a fragment", "GET", "/olympus/v1/minerva/availability-block/..#"],
    [
      "a fragment after an allowed path",
      "GET",
      "/olympus/v1/minerva/availability-block/b-1#x",
    ],
    ["another host", "GET", "/olympus//evil.example/v1/minerva/availability"],
    [
      "a control character",
      "GET",
      "/olympus/v1/minerva/availability-block/b\n1",
    ],
  ])("refuses %s", (_what, method, url) => {
    expect(forwardedPath(method, url)).toBeUndefined();
  });
});
