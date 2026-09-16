import { combineAvailability, mapFreeBusyToAvailability } from "../../../src/domain/availability";

describe("mapFreeBusyToAvailability", () => {
  it("maps busy to busy", () => {
    expect(mapFreeBusyToAvailability("busy")).toBe("busy");
  });

  it("maps tentative to interruptable", () => {
    expect(mapFreeBusyToAvailability("tentative")).toBe("interruptable");
  });

  it("maps out_of_office to none", () => {
    expect(mapFreeBusyToAvailability("out_of_office")).toBe("none");
  });

  it("maps working_elsewhere to none", () => {
    expect(mapFreeBusyToAvailability("working_elsewhere")).toBe("none");
  });

  it("maps free to free", () => {
    expect(mapFreeBusyToAvailability("free")).toBe("free");
  });
});

describe("combineAvailability", () => {
  it("returns the single status unchanged", () => {
    expect(combineAvailability(["interruptable"])).toBe("interruptable");
  });

  it("busy outranks everything else", () => {
    expect(combineAvailability(["free", "busy", "interruptable", "none"])).toBe("busy");
  });

  it("interruptable outranks free and none", () => {
    expect(combineAvailability(["free", "interruptable", "none"])).toBe("interruptable");
  });

  it("free outranks none", () => {
    expect(combineAvailability(["none", "free"])).toBe("free");
  });

  it("none wins only when it's all there is", () => {
    expect(combineAvailability(["none", "none"])).toBe("none");
  });

  it("is order-independent", () => {
    expect(combineAvailability(["busy", "none", "free"])).toBe(combineAvailability(["none", "free", "busy"]));
  });

  it("throws on an empty list", () => {
    expect(() => combineAvailability([])).toThrow();
  });
});
