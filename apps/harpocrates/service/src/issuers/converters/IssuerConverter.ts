import type {
  Issuer as IssuerRow,
  IssuerExtendedKeyUsage,
  IssuerNameConstraint,
} from "@prisma/client";
import moment from "moment";
import type { NameConstraints, Names, NameTypeName } from "../../model/common";
import type { FullIssuer, Issuer } from "../../model/issuers";
import { certificatePem } from "../../pki/x509";
import { issuingWindowClosesAt } from "../issuingWindow";

export type IssuerWithRules = IssuerRow & {
  extendedKeyUsages: IssuerExtendedKeyUsage[];
  nameConstraints: IssuerNameConstraint[];
};

export const ISSUER_RULES = {
  extendedKeyUsages: true,
  nameConstraints: true,
} as const;

const buildNames = (
  constraints: IssuerNameConstraint[],
  kind: "permitted" | "excluded",
): Names | undefined => {
  const chosen = constraints.filter((c) => c.kind === kind);
  if (chosen.length === 0) return undefined;
  const names: Names = {};
  for (const constraint of chosen) {
    const type = constraint.type as NameTypeName;
    names[type] = [...(names[type] ?? []), constraint.value];
  }
  return names;
};

export const buildNameConstraints = (
  constraints: IssuerNameConstraint[],
): NameConstraints => ({
  permitted: buildNames(constraints, "permitted"),
  excluded: buildNames(constraints, "excluded"),
});

export const toDomainObject = (row: IssuerWithRules): Issuer => ({
  id: row.id,
  subject: row.subject,
  tier: row.tier,
  status: row.status,
  purpose: row.purpose ?? undefined,
  number: row.number,
  generation: row.generation,
  parentId: row.parentId ?? undefined,
  offline: row.tier !== "issuing",
  notBefore: row.notBefore ? moment(row.notBefore) : undefined,
  notAfter: row.notAfter ? moment(row.notAfter) : undefined,
  issuingWindowClosesAt: row.notAfter
    ? moment(issuingWindowClosesAt(row.notAfter, row.maxValidityDays))
    : undefined,
  pathLength: row.pathLength ?? undefined,
  maxValidityDays: row.maxValidityDays,
  extendedKeyUsages: row.extendedKeyUsages.map((u) => u.oid).sort(),
  nameConstraints: buildNameConstraints(row.nameConstraints),
  crlUrl: row.crlUrl,
  caIssuersUrl: row.caIssuersUrl,
});

export const toFullIssuer = (
  row: IssuerWithRules,
  chain: string[],
): FullIssuer => ({
  ...toDomainObject(row),
  certificate: row.certificate ? certificatePem(row.certificate) : undefined,
  chain,
});

/** Constraint rows from the model's shape. */
export const constraintRows = (constraints: NameConstraints | undefined) =>
  (["permitted", "excluded"] as const).flatMap((kind) =>
    Object.entries(constraints?.[kind] ?? {}).flatMap(
      ([type, values]) =>
        (values as string[] | undefined)?.map((value) => ({
          kind,
          type: type as NameTypeName,
          value,
        })) ?? [],
    ),
  );
