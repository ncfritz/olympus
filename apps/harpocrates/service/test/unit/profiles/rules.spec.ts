import { describe, expect, it } from "vitest";
import {
  type AttributeRule,
  checkNames,
  csrHashProblem,
  customExtensionProblem,
  isOneDerElement,
  keyAlgorithmProblem,
  resolveSubject,
  resolveUsages,
  subjectString,
  subtreeProblem,
} from "../../../src/profiles/rules";

const rule = (
  oid: string,
  overrides: Partial<AttributeRule> = {},
): AttributeRule => ({
  oid,
  presence: "optional",
  locked: false,
  maxCount: 1,
  ...overrides,
});
const CN = "2.5.4.3";
const O = "2.5.4.10";
const OU = "2.5.4.11";
const C = "2.5.4.6";
const EMAIL = "1.2.840.113549.1.9.1";
const TITLE = "2.5.4.12";

/** Today's rules, as the migration seeds them. */
const seeded = [rule(CN, { presence: "required" }), rule(OU), rule(O)];

describe("profile rules", () => {
  describe("the subject", () => {
    it("keeps today's subject: CN, OU, and the configured O by default", () => {
      const resolved = resolveSubject(
        seeded,
        [
          { type: "CN", value: "minerva" },
          { type: "OU", value: "production" },
        ],
        "ncfritz.net",
      );
      expect(resolved.problems).toEqual([]);
      expect("value" in resolved && subjectString(resolved.value)).toBe(
        "CN=minerva,OU=production,O=ncfritz.net",
      );
    });

    it("needs what is required, refuses what is excluded or unknown", () => {
      expect(
        resolveSubject(
          [...seeded, rule(TITLE, { presence: "excluded" })],
          [
            { type: "title", value: "x" },
            { type: "L", value: "Portland" },
            { type: "nonsense", value: "x" },
          ],
          "ncfritz.net",
        ).problems,
      ).toEqual([
        "nonsense is not a subject attribute",
        "the subject may not hold title",
        "the subject may not hold L",
        "the subject needs CN",
      ]);
    });

    it("fills defaults, holds locked values, checks patterns and counts", () => {
      const rules = [
        rule(C, { presence: "required", defaultValue: "US", locked: true }),
        rule(OU, { maxCount: 2, pattern: "[a-z]+" }),
        rule(CN, { presence: "required" }),
        rule(O, { presence: "excluded" }),
      ];
      const ok = resolveSubject(
        rules,
        [
          { type: "CN", value: "host" },
          { type: "OU", value: "a" },
          { type: "OU", value: "b" },
        ],
        "ncfritz.net",
      );
      expect("value" in ok && subjectString(ok.value)).toBe(
        "CN=host,OU=b,OU=a,C=US",
      );
      expect(
        resolveSubject(
          rules,
          [
            { type: "CN", value: "host" },
            { type: "C", value: "GB" },
            { type: "OU", value: "A" },
            { type: "OU", value: "b" },
            { type: "OU", value: "c" },
          ],
          "ncfritz.net",
        ).problems,
      ).toEqual([
        "C is fixed at US",
        "OU may take 2 values, not 3",
        'OU "A" does not match [a-z]+',
      ]);
    });

    it("writes attributes the signer has no short name for by OID, escaped", () => {
      const resolved = resolveSubject(
        [
          rule(CN, { presence: "required" }),
          rule(EMAIL),
          rule(O, { presence: "excluded" }),
        ],
        [
          { type: "CN", value: "a,b" },
          { type: "emailAddress", value: "neil@ncfritz.net" },
        ],
        "ncfritz.net",
      );
      expect("value" in resolved && subjectString(resolved.value)).toBe(
        "1.2.840.113549.1.9.1=neil@ncfritz.net,CN=a\\,b",
      );
    });

    it("refuses a malformed country", () => {
      expect(
        resolveSubject(
          [rule(C, { presence: "required" })],
          [{ type: "C", value: "usa" }],
          "x",
        ).problems,
      ).toEqual(['C is a two-letter country code, not "usa"']);
    });
  });

  describe("usages", () => {
    const states = [
      { name: "digital_signature", state: "forced" as const },
      { name: "key_encipherment", state: "default" as const },
      { name: "key_agreement", state: "optional" as const },
    ];

    it("gives the forced and default ones when nothing is asked", () => {
      expect(resolveUsages(states, undefined, undefined, "key usage")).toEqual({
        value: ["digital_signature", "key_encipherment"],
        problems: [],
      });
    });

    it("lets a request drop a default and add an optional, never the forced", () => {
      expect(
        resolveUsages(states, ["key_agreement"], undefined, "key usage"),
      ).toEqual({
        value: ["digital_signature", "key_agreement"],
        problems: [],
      });
    });

    it("refuses a request for an excluded one; passes over a CSR's", () => {
      expect(
        resolveUsages(states, ["crl_sign"], undefined, "key usage").problems,
      ).toEqual(["the profile excludes the key usage crl_sign"]);
      expect(
        resolveUsages(
          states,
          undefined,
          ["crl_sign", "key_agreement"],
          "key usage",
        ),
      ).toEqual({
        value: ["digital_signature", "key_agreement"],
        problems: [],
      });
    });
  });

  describe("names", () => {
    const rules = [
      { type: "dns", presence: "required" as const },
      { type: "ip", presence: "allowed" as const },
      { type: "email", presence: "allowed" as const },
      { type: "uri", presence: "allowed" as const },
    ];
    const policy = [
      {
        type: "dns",
        kind: "permitted" as const,
        value: "internal.ncfritz.net",
      },
      {
        type: "dns",
        kind: "excluded" as const,
        value: "secret.internal.ncfritz.net",
      },
      { type: "ip", kind: "permitted" as const, value: "192.168.15.0/24" },
      { type: "email", kind: "permitted" as const, value: "ncfritz.net" },
      { type: "uri", kind: "permitted" as const, value: ".ncfritz.net" },
    ];

    it("takes names inside the permitted subtrees", () => {
      expect(
        checkNames(rules, 1, policy, [
          { type: "dns", value: "nas.internal.ncfritz.net" },
          { type: "dns", value: "internal.ncfritz.net" },
          { type: "ip", value: "192.168.15.10" },
          { type: "email", value: "neil@ncfritz.net" },
          { type: "uri", value: "https://api.ncfritz.net/x" },
        ]),
      ).toEqual([]);
    });

    it("refuses names outside them, inside an excluded one, or of a type not allowed", () => {
      expect(
        checkNames(rules.slice(1), 2, policy, [
          { type: "dns", value: "a.secret.internal.ncfritz.net" },
          { type: "ip", value: "10.0.0.1" },
          { type: "uri", value: "https://ncfritz.net" },
        ]),
      ).toEqual([
        "the profile does not allow dns names",
        "a.secret.internal.ncfritz.net is in an excluded subtree (secret.internal.ncfritz.net)",
        "10.0.0.1 is outside the permitted ip subtrees (192.168.15.0/24)",
        "https://ncfritz.net is outside the permitted uri subtrees (.ncfritz.net)",
      ]);
    });

    it("needs required types and enough names", () => {
      expect(
        checkNames(rules, 2, [], [{ type: "ip", value: "10.0.0.1" }]),
      ).toEqual([
        "the profile needs at least one dns name",
        "the profile needs at least 2 alternative names",
      ]);
    });

    it("knows a malformed subtree", () => {
      expect(subtreeProblem("ip", "10.0.0.0/8")).toBeUndefined();
      expect(subtreeProblem("ip", "10.0.0.0")).toMatch(/not an IP network/);
      expect(subtreeProblem("dns", "a b")).toMatch(/not a dns subtree/);
    });
  });

  it("limits key types and CSR hashes, an empty list allowing any", () => {
    expect(keyAlgorithmProblem([], "RSA-2048")).toBeUndefined();
    expect(keyAlgorithmProblem(["P-256", "P-384"], "RSA-2048")).toBe(
      "the profile allows P-256, P-384 keys, not RSA-2048",
    );
    expect(csrHashProblem(["sha256"], "sha1")).toMatch(/not sha1/);
    expect(csrHashProblem(["sha256"], undefined)).toBeUndefined();
  });

  it("takes a custom extension only unmanaged and one DER element", () => {
    expect(isOneDerElement(Buffer.from([0x05, 0x00]))).toBe(true);
    const long = Buffer.concat([
      Buffer.from([0x04, 0x81, 0x80]),
      Buffer.alloc(0x80),
    ]);
    expect(isOneDerElement(long)).toBe(true);
    expect(isOneDerElement(Buffer.from([0x05, 0x00, 0x05, 0x00]))).toBe(false);
    expect(
      isOneDerElement(Buffer.from([0x04, 0x81, 0x05, 1, 2, 3, 4, 5])),
    ).toBe(false);
    expect(isOneDerElement(Buffer.from([0x05]))).toBe(false);
    expect(customExtensionProblem("1.3.6.1.4.1.1.1", "BQA=")).toBeUndefined();
    expect(customExtensionProblem("2.5.29.17", "BQA=")).toMatch(
      /subject alternative name\) is not a custom extension/,
    );
    expect(customExtensionProblem("1.3.6.1.4.1.1.1", "BQ==")).toMatch(
      /not one DER element/,
    );
  });
});
