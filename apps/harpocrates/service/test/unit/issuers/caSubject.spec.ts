import { describe, expect, it } from "vitest";
import {
  caOrganizationOf,
  caSubjectOf,
  caSubjectProblems,
} from "../../../src/issuers/caSubject";

describe("a CA's subject from its parts (ADR 0032, Names and settings)", () => {
  it("ends the common name with its numbering, its attributes in DN order", () => {
    expect(
      caSubjectOf(
        "ncfritz.net Root CA",
        "1 - G1",
        [
          { type: "O", value: "ncfritz.net" },
          { type: "C", value: "US" },
          { type: "OU", value: "Home Lab" },
          { type: "emailAddress", value: "pki@ncfritz.net" },
        ],
        "unused",
      ),
    ).toBe(
      "1.2.840.113549.1.9.1=pki@ncfritz.net,CN=ncfritz.net Root CA 1 - G1,OU=Home Lab,O=ncfritz.net,C=US",
    );
  });

  it("carries the organisation as O when no attributes are given", () => {
    expect(caSubjectOf("Lab Root CA", "2 - G3", undefined, "Example Lab")).toBe(
      "CN=Lab Root CA 2 - G3,O=Example Lab",
    );
  });

  it("escapes what RFC 4514 needs escaped", () => {
    expect(
      caSubjectOf("Root CA", "1 - G1", [{ type: "O", value: "A, B" }], ""),
    ).toBe("CN=Root CA 1 - G1,O=A\\, B");
  });

  it("takes the organisation from the O attribute when attributes are given", () => {
    expect(
      caOrganizationOf({ subjectAttributes: [{ type: "O", value: "Lab" }] }),
    ).toBe("Lab");
    expect(
      caOrganizationOf({ subjectAttributes: [{ type: "C", value: "US" }] }),
    ).toBeUndefined();
    expect(caOrganizationOf({ organization: "Lab" })).toBe("Lab");
  });

  it("refuses what it cannot build", () => {
    expect(caSubjectProblems({ commonName: "Root CA" })).toEqual([]);
    expect(
      caSubjectProblems({ subject: "CN=X", commonName: "Root CA" }),
    ).toHaveLength(1);
    expect(
      caSubjectProblems({
        organization: "Lab",
        subjectAttributes: [{ type: "C", value: "US" }],
      }),
    ).toHaveLength(1);
    expect(
      caSubjectProblems({
        subjectAttributes: [
          { type: "CN", value: "x" },
          { type: "nonsense", value: "x" },
          { type: "C", value: "USA" },
          { type: "OU", value: "a" },
          { type: "ou", value: "b" },
        ],
      }),
    ).toEqual([
      "The common name is given on its own: its number and generation are appended to it",
      "nonsense is not a subject attribute",
      "The country is two capital letters, not USA",
      "ou is given twice",
    ]);
  });
});
