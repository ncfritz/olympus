import { HttpStatus } from "@nestjs/common";
import { DECORATORS } from "@nestjs/swagger";
import { describe, expect, it } from "vitest";
import { ErrorResponse } from "../types/error";
import { ApiStandardErrorResponses } from "./controllerDecorators";

const responsesOf = (decorator: MethodDecorator) => {
  class Target {
    handle() {}
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    Target.prototype,
    "handle",
  )!;
  decorator(Target.prototype, "handle", descriptor);
  return Reflect.getMetadata(
    DECORATORS.API_RESPONSE,
    descriptor.value,
  ) as Record<string, { description: string; type: () => unknown }>;
};

describe("ApiStandardErrorResponses", () => {
  it("documents 400 and 404 with ErrorResponse", () => {
    const responses = responsesOf(ApiStandardErrorResponses());
    expect(Object.keys(responses).sort()).toEqual(["400", "404"]);
    expect(responses["404"].type()).toBe(ErrorResponse);
  });

  it("leaves out excluded statuses", () => {
    const responses = responsesOf(
      ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] }),
    );
    expect(Object.keys(responses)).toEqual(["400"]);
  });
});
