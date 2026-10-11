import { describe, expect, it } from "vitest";
import { checkNames, resolveSubject } from "../../../src/profiles/rules";
import { sampleNames, sampleSubject } from "../../../src/profiles/samples";

describe("preview samples", () => {
  it("makes names the version accepts", () => {
    const rules = [
      { type: "dns", presence: "required" as const },
      { type: "ip", presence: "allowed" as const },
      { type: "upn", presence: "required" as const },
    ];
    const policy = [
      {
        type: "dns",
        kind: "permitted" as const,
        value: ".internal.ncfritz.net",
      },
      { type: "ip", kind: "permitted" as const, value: "192.168.15.0/24" },
    ];
    const names = sampleNames(rules, 4, policy);
    expect(names).toEqual({
      dns: ["preview.internal.ncfritz.net", "preview2.internal.ncfritz.net"],
      ip: ["192.168.15.10"],
      upn: ["preview@example.com"],
    });
    const given = Object.entries(names).flatMap(([type, values]) =>
      (values as string[]).map((value) => ({ type, value })),
    );
    expect(checkNames(rules, 4, policy, given)).toEqual([]);
    expect(sampleNames([], 0, [])).toEqual({});
  });

  it("makes a subject the version accepts", () => {
    const rule = (
      oid: string,
      presence: "required" | "optional",
      extra = {},
    ) => ({
      oid,
      presence,
      locked: false,
      maxCount: 1,
      ...extra,
    });
    const rules = [
      rule("2.5.4.6", "required"),
      rule("2.5.4.8", "required", { defaultValue: "Oregon" }),
      rule("2.5.4.10", "required"),
      rule("2.5.4.12", "required"),
      rule("2.5.4.3", "optional"),
    ];
    const subject = sampleSubject(rules);
    expect(subject).toEqual({
      commonName: "preview",
      attributes: [
        { type: "C", value: "US" },
        { type: "title", value: "preview" },
      ],
    });
    const resolved = resolveSubject(
      rules,
      [{ type: "CN", value: subject.commonName! }, ...subject.attributes],
      "ncfritz.net",
    );
    expect(resolved.problems).toEqual([]);
  });
});
