import { Controller, Get, Post, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { locationOf, setLocation } from "../../../src/utils/location";

@Controller({ version: "1" })
class DescribeThingController {
  @Get("/thing/:thingId/part/:partNumber")
  handle(@Res() _response: Response) {}
}

@Controller({ version: "2" })
class DescribeOtherController {
  @Get("other/:id")
  handle(@Res() _response: Response) {}
}

@Controller({ version: "1" })
class CreateThingController {
  @Post("/things")
  handle(@Res() _response: Response) {}
}

const request = (path: string, headers: Record<string, string> = {}) =>
  ({ path, headers }) as unknown as Request;

describe("locationOf", () => {
  it("builds the target's route", () => {
    expect(
      locationOf(request("/v1/things"), DescribeThingController, {
        thingId: "t-1",
        partNumber: 3,
      }),
    ).toBe("/v1/thing/t-1/part/3");
  });

  it("uses the target's version and adds a missing leading slash", () => {
    expect(
      locationOf(request("/v1/others"), DescribeOtherController, {
        id: 7,
      }),
    ).toBe("/v2/other/7");
  });

  it("encodes parameter values", () => {
    expect(
      locationOf(request("/v1/x"), DescribeOtherController, {
        id: "a b/c?d",
      }),
    ).toBe("/v2/other/a%20b%2Fc%3Fd");
  });

  it.each([
    ["/api", "/api/v2/other/7"],
    ["/api/", "/api/v2/other/7"],
    ["/olympus/api", "/olympus/api/v2/other/7"],
    ["https://evil.example", "/v2/other/7"],
    ["/api\r\nSet-Cookie: x=1", "/v2/other/7"],
    ["api", "/v2/other/7"],
  ])(
    "honors X-Forwarded-Prefix %j only when it is a plain path",
    (prefix, expected) => {
      expect(
        locationOf(
          request("/v1/x", { "x-forwarded-prefix": prefix }),
          DescribeOtherController,
          { id: 7 },
        ),
      ).toBe(expected);
    },
  );

  it("rejects a missing or unknown parameter", () => {
    expect(() =>
      locationOf(request("/v1/x"), DescribeThingController, { thingId: 1 }),
    ).toThrow('needs route parameter "partNumber"');
    expect(() =>
      locationOf(request("/v1/x"), DescribeOtherController, {
        id: 1,
        extra: 2,
      }),
    ).toThrow('has no route parameter "extra"');
  });

  it("only targets GET operations", () => {
    expect(() =>
      locationOf(request("/v1/x"), CreateThingController, {}),
    ).toThrow("is not a GET operation");
  });
});

describe("setLocation", () => {
  it("sets the Location header", () => {
    const response = { setHeader: vi.fn().mockReturnThis() };

    setLocation(
      response as unknown as Response,
      request("/v1/x"),
      DescribeOtherController,
      { id: 7 },
    );

    expect(response.setHeader).toHaveBeenCalledWith("Location", "/v2/other/7");
  });
});
