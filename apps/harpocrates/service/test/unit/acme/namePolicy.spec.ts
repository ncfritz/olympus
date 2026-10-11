import { describe, expect, it } from "vitest";
import {
  dnsNameProblem,
  normaliseDnsName,
  permits,
} from "../../../src/acme/namePolicy";

describe("an EAB credential's name policy", () => {
  const policy = [
    { kind: "exact" as const, value: "nas.internal.ncfritz.net" },
    { kind: "subtree" as const, value: "lab.internal.ncfritz.net" },
  ];

  it("permits an exact name, and only it", () => {
    expect(permits(policy, "nas.internal.ncfritz.net")).toBe(true);
    expect(permits(policy, "x.nas.internal.ncfritz.net")).toBe(false);
  });

  it("permits a subtree's name and every name below it", () => {
    expect(permits(policy, "lab.internal.ncfritz.net")).toBe(true);
    expect(permits(policy, "a.b.lab.internal.ncfritz.net")).toBe(true);
  });

  it("does not mistake a suffix for a subtree", () => {
    expect(permits(policy, "notlab.internal.ncfritz.net")).toBe(false);
    expect(permits(policy, "internal.ncfritz.net")).toBe(false);
  });

  it("normalises names as clients send them", () => {
    expect(normaliseDnsName(" NAS.Internal.ncfritz.net. ")).toBe(
      "nas.internal.ncfritz.net",
    );
  });

  it.each([
    ["*.lab.internal.ncfritz.net", /wildcards/],
    ["localhost", /fully qualified/],
    ["10.0.0.1", /IP address/],
    ["bad_name.internal.ncfritz.net", /not a DNS name/],
    ["-x.internal.ncfritz.net", /not a DNS name/],
  ])("refuses %s", (name, problem) => {
    expect(dnsNameProblem(name)).toMatch(problem);
  });

  it("takes a DNS name", () => {
    expect(dnsNameProblem("git.internal.ncfritz.net")).toBeUndefined();
  });
});
