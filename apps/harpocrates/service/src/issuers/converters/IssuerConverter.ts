import type {
  Issuer as IssuerRow,
  IssuerExtendedKeyUsage,
  IssuerAlternativeName,
  IssuerNameConstraint,
} from "../../store/prisma";
import moment from "moment";
import type {
  ContactNames,
  NameConstraints,
  Names,
  SubtreeNameTypeName,
} from "../../model/common";
import type { FullIssuer, Issuer } from "../../model/issuers";
import { certificatePem, toPem } from "../../pki/x509";
import { issuingWindowClosesAt } from "../issuingWindow";

export type IssuerWithRules = IssuerRow & {
  extendedKeyUsages: IssuerExtendedKeyUsage[];
  nameConstraints: IssuerNameConstraint[];
  alternativeNames: IssuerAlternativeName[];
};

export const ISSUER_RULES = {
  extendedKeyUsages: true,
  nameConstraints: true,
  alternativeNames: true,
} as const;

/** A CA's alternative names, by type. */
export const buildContactNames = (
  names: IssuerAlternativeName[],
): ContactNames => {
  const result: ContactNames = {};
  for (const name of [...names].sort((a, b) => a.id - b.id)) {
    if (name.type === "email" || name.type === "uri") {
      result[name.type] = [...(result[name.type] ?? []), name.value];
    }
  }
  return result;
};

const buildNames = (
  constraints: IssuerNameConstraint[],
  kind: "permitted" | "excluded",
): Names | undefined => {
  const chosen = constraints.filter((c) => c.kind === kind);
  if (chosen.length === 0) return undefined;
  const names: Names = {};
  for (const constraint of chosen) {
    const type = constraint.type as SubtreeNameTypeName;
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
  organization: row.organization ?? undefined,
  shape: row.shape ?? undefined,
  provedAt: row.provedAt ? moment(row.provedAt) : undefined,
  discardedAt: row.discardedAt ? moment(row.discardedAt) : undefined,
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
  alternativeNames: buildContactNames(row.alternativeNames),
});

export const toFullIssuer = (
  row: IssuerWithRules,
  chain: string[],
): FullIssuer => ({
  ...toDomainObject(row),
  certificate: row.certificate ? certificatePem(row.certificate) : undefined,
  csr: row.csr ? toPem(row.csr, "CERTIFICATE REQUEST") : undefined,
  chain,
});

/** Constraint rows from the model's shape. */
export const constraintRows = (constraints: NameConstraints | undefined) =>
  (["permitted", "excluded"] as const).flatMap((kind) =>
    Object.entries(constraints?.[kind] ?? {}).flatMap(
      ([type, values]) =>
        (values as string[] | undefined)?.map((value) => ({
          kind,
          type: type as SubtreeNameTypeName,
          value,
        })) ?? [],
    ),
  );
