/**
 * A CA's subject from its parts (ADR 0032, Names and settings): its
 * common name, to which its number and generation are always appended,
 * and the subject's other attributes, as a certificate's.
 */
import { attributeOid } from "../profiles/subjectAttributes";
import { subjectString } from "../profiles/rules";

export type CaSubjectValue = { type: string; value: string };

/** What names a CA beyond its parts, as a request gives it. */
export type CaNaming = {
  organization?: string;
  subject?: string;
  commonName?: string;
  subjectAttributes?: CaSubjectValue[];
};

const CN = "2.5.4.3";
const O = "2.5.4.10";
const C = "2.5.4.6";

/** Whether the request names the CA by its common name and attributes. */
export const namedByParts = (naming: CaNaming): boolean =>
  naming.commonName !== undefined || naming.subjectAttributes !== undefined;

/** Why a request's naming would be refused; empty when it would not. */
export const caSubjectProblems = (naming: CaNaming): string[] => {
  const problems: string[] = [];
  if (naming.subject !== undefined && namedByParts(naming)) {
    problems.push(
      "Give the subject outright or its common name and attributes, not both",
    );
  }
  if (naming.organization !== undefined && naming.subjectAttributes) {
    problems.push(
      "Give the organisation as the subject's O attribute, not as well as it",
    );
  }
  const seen = new Set<string>();
  for (const { type, value } of naming.subjectAttributes ?? []) {
    const oid = attributeOid(type);
    if (!oid) {
      problems.push(`${type} is not a subject attribute`);
      continue;
    }
    if (oid === CN) {
      problems.push(
        "The common name is given on its own: its number and generation are appended to it",
      );
    }
    if (seen.has(oid)) problems.push(`${type} is given twice`);
    seen.add(oid);
    if (oid === C && !/^[A-Z]{2}$/.test(value)) {
      problems.push(`The country is two capital letters, not ${value}`);
    }
  }
  return problems;
};

/** The organisation a request gives: its O attribute, or its organisation. */
export const caOrganizationOf = (naming: CaNaming): string | undefined =>
  naming.subjectAttributes
    ? naming.subjectAttributes.find((a) => attributeOid(a.type) === O)?.value
    : naming.organization;

/**
 * The subject of a CA named by its parts: `<common name> <numbering>`, and
 * the attributes given; without any, its organisation as O.
 */
export const caSubjectOf = (
  commonName: string,
  numbering: string,
  attributes: CaSubjectValue[] | undefined,
  organization: string,
): string =>
  subjectString([
    { oid: CN, value: `${commonName} ${numbering}` },
    ...(attributes ?? [{ type: "O", value: organization }]).map((a) => ({
      oid: attributeOid(a.type)!,
      value: a.value,
    })),
  ]);
