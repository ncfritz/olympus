import { instanceToPlain } from "class-transformer";
import moment, { type Moment } from "moment";
import { describe, expect, it } from "vitest";
import { ApiTimestamp } from "../src";

class Stamped {
  @ApiTimestamp({ required: true, description: "created" })
  createdTime: Moment;

  @ApiTimestamp({ required: false, description: "finished" })
  finishedTime?: Moment;
}

describe("ApiTimestamp", () => {
  it("serializes a Moment as an ISO-8601 string", () => {
    const value = Object.assign(new Stamped(), {
      createdTime: moment.utc("2026-09-18T12:34:56Z"),
    });
    expect(instanceToPlain(value)).toEqual({
      createdTime: "2026-09-18T12:34:56.000Z",
    });
  });

  it("leaves a missing optional timestamp undefined instead of throwing", () => {
    const value = Object.assign(new Stamped(), {
      createdTime: moment.utc("2026-09-18T00:00:00Z"),
      finishedTime: undefined,
    });
    expect(instanceToPlain(value).finishedTime).toBeUndefined();
  });
});
