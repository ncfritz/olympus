import type {
  CaKeyAlgorithm,
  IssuerShape,
  NameConstraints,
  PreviewIssuerRequest,
} from "./api/types";
import { KEY_FAMILIES, type KeyFamily } from "./keyTypes";

/**
 * A new root's name and settings as its form holds them (ADR 0032, Names
 * and settings), and the preview request they make.
 */

/** The key types a CA's key may be (ADR 0038): DSA and Ed25519 are for leaves. */
export const CA_KEY_ALGORITHMS: CaKeyAlgorithm[] = [
  "P-256",
  "P-384",
  "P-521",
  "RSA-2048",
  "RSA-3072",
  "RSA-4096",
  "RSA-8192",
];

/** The key families and sizes or curves a CA may have, as the issuance form offers them. */
export const CA_KEY_FAMILIES = KEY_FAMILIES.map((family) => ({
  ...family,
  algorithms: family.algorithms.filter((a) =>
    (CA_KEY_ALGORITHMS as string[]).includes(a.value),
  ),
})).filter((family) => family.algorithms.length > 0);

/** The family a CA key type belongs to. */
export const caFamilyOf = (algorithm: CaKeyAlgorithm): KeyFamily =>
  CA_KEY_FAMILIES.find((f) => f.algorithms.some((a) => a.value === algorithm))!
    .family;

/** The subject attributes the form offers, as a certificate's standard set. */
export const ROOT_SUBJECT_ATTRIBUTES = [
  { type: "C", label: "Country", help: "Two capital letters: US, GB, DE" },
  { type: "ST", label: "State or province", help: "Written out: California" },
  { type: "L", label: "Locality", help: "A city or town" },
  {
    type: "O",
    label: "Organization",
    help: "Its organisation: everything beneath this root takes it",
  },
  {
    type: "OU",
    label: "Organizational unit",
    help: "A part of the organisation, if it has any",
  },
  {
    type: "emailAddress",
    label: "Email address",
    help: "Who to reach about this CA; most CAs leave it out",
  },
] as const;

export type RootAttribute = (typeof ROOT_SUBJECT_ATTRIBUTES)[number]["type"];

/** A name type a constraint applies to (RFC 5280, name constraints). */
export type ConstraintType = "dns" | "ip" | "email" | "uri";

export type Constraint = { type: ConstraintType; value: string };

/** A root's validity: a number of years, or another length. */
export type ValidityChoice =
  "5" | "10" | "15" | "20" | "25" | "50" | "75" | "other";

export const VALIDITY_CHOICES: { value: ValidityChoice; label: string }[] = [
  ...(["5", "10", "15", "20", "25", "50", "75"] as const).map((years) => ({
    value: years,
    label: `${years} years`,
  })),
  { value: "other", label: "Other" },
];

export type ValidityUnit = "days" | "months" | "years";

/** Days in a unit, as the service counts a CA's validity: a year is 365. */
const UNIT_DAYS: Record<ValidityUnit, number> = {
  days: 1,
  months: 30,
  years: 365,
};

/** Another length in days: whole years of 365, months of 30. */
export const validityDaysOf = (
  amount: number | undefined,
  unit: ValidityUnit = "years",
): number | undefined => {
  if (!amount || amount < 1) return undefined;
  if (unit === "months") {
    return Math.floor(amount / 12) * 365 + (amount % 12) * 30;
  }
  return amount * UNIT_DAYS[unit];
};

/** A number of days as "X years, Y months, Z days", leaving out the zeros. */
export const describeValidity = (days: number): string => {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rest = (days % 365) % 30;
  const part = (n: number, unit: string) =>
    n ? `${n} ${unit}${n === 1 ? "" : "s"}` : undefined;
  return (
    [part(years, "year"), part(months, "month"), part(rest, "day")]
      .filter(Boolean)
      .join(", ") || "0 days"
  );
};

/** The validity the form holds, in days. */
export const formValidityDays = (values: RootFormValues): number | undefined =>
  values.validity === "other"
    ? validityDaysOf(values.validityAmount, values.validityUnit)
    : values.validity
      ? Number(values.validity) * 365
      : undefined;

export interface RootFormValues {
  keyFamily?: KeyFamily;
  algorithm?: CaKeyAlgorithm;
  validity?: ValidityChoice;
  validityAmount?: number;
  validityUnit?: ValidityUnit;
  commonName?: string;
  purpose?: string;
  number?: number;
  generation?: number;
  attributes?: Partial<Record<RootAttribute, string>>;
  permitted?: Constraint[];
  excluded?: Constraint[];
}

/** What the service builds by default, to leave out what was not changed. */
export interface RootDefaults {
  algorithm: CaKeyAlgorithm;
  validityDays: number;
  commonName: string;
  organization: string;
}

const text = (value: string | undefined) => value?.trim() || undefined;

/** A subject's CN, without its numbering: what the form's common name holds. */
export const commonNameStemOf = (subject: string): string | undefined => {
  const cn = /(?:^|,)CN=((?:\\.|[^,])*)/.exec(subject)?.[1];
  return cn?.replace(/\\(.)/g, "$1").replace(/ \d+ - G\d+$/, "");
};

/** The constraints the form holds, by type, or none. */
export const constraintsOf = (
  permitted: Constraint[] = [],
  excluded: Constraint[] = [],
): NameConstraints | undefined => {
  const byType = (list: Constraint[]) => {
    const names: Partial<Record<ConstraintType, string[]>> = {};
    for (const { type, value } of list) {
      names[type] = [...(names[type] ?? []), value];
    }
    return Object.keys(names).length ? names : undefined;
  };
  const constraints = {
    permitted: byType(permitted),
    excluded: byType(excluded),
  };
  return constraints.permitted || constraints.excluded
    ? constraints
    : undefined;
};

/**
 * The preview request (and the create request's settings) from the form:
 * only what differs from what the service would build anyway, so the
 * audit log records exactly what the operator changed (ADR 0032).
 */
export const rootRequestOf = (
  shape: IssuerShape,
  values: RootFormValues,
  defaults: RootDefaults | undefined,
): PreviewIssuerRequest => {
  const attributes = ROOT_SUBJECT_ATTRIBUTES.map(({ type }) => ({
    type,
    value: text(values.attributes?.[type]),
  })).filter((a): a is { type: RootAttribute; value: string } =>
    Boolean(a.value),
  );
  const onlyTheOrganization =
    attributes.length === 1 &&
    attributes[0].type === "O" &&
    attributes[0].value === defaults?.organization;
  const commonName = text(values.commonName);
  const validityDays = formValidityDays(values);
  const subjectAttributes =
    defaults && !onlyTheOrganization ? attributes : undefined;
  return {
    tier: "root",
    shape,
    purpose: text(values.purpose),
    number: values.number ?? 1,
    generation: values.generation ?? 1,
    // With attributes given the service would begin the default CN with
    // their O, not the realm: the form's CN is sent, as the form shows it.
    commonName:
      commonName && (commonName !== defaults?.commonName || subjectAttributes)
        ? commonName
        : undefined,
    subjectAttributes,
    validityDays:
      validityDays !== undefined && validityDays !== defaults?.validityDays
        ? validityDays
        : undefined,
    algorithm:
      values.algorithm && values.algorithm !== defaults?.algorithm
        ? values.algorithm
        : undefined,
    nameConstraints: constraintsOf(values.permitted, values.excluded),
  };
};

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`, "i");
const HOST = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`, "i");

const ipv4 = (address: string) => {
  const parts = address.split(".");
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  );
};

const ipv6 = (address: string) => {
  if (!address.includes(":")) return false;
  try {
    new URL(`http://[${address}]`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Why a constraint's value would not do, or undefined if it would: as
 * RFC 5280 writes each type's subtree.
 */
export const constraintProblem = (
  type: ConstraintType,
  value: string,
): string | undefined => {
  switch (type) {
    case "dns":
      return HOST.test(value.replace(/^\./, ""))
        ? undefined
        : "A domain: internal.ncfritz.net";
    case "ip": {
      const [address, bits, extra] = value.split("/");
      if (extra !== undefined || bits === undefined || !/^\d+$/.test(bits)) {
        return "A network with its prefix: 192.168.15.0/24";
      }
      if (ipv4(address)) {
        return Number(bits) <= 32 ? undefined : "At most /32";
      }
      if (ipv6(address)) {
        return Number(bits) <= 128 ? undefined : "At most /128";
      }
      return "A network with its prefix: 192.168.15.0/24";
    }
    case "email": {
      const at = value.lastIndexOf("@");
      const domain = at >= 0 ? value.slice(at + 1) : value.replace(/^\./, "");
      const local = at >= 0 ? value.slice(0, at) : "";
      return DOMAIN.test(domain) && !/[\s@]/.test(local)
        ? undefined
        : "A mailbox, or a domain: ncfritz.net";
    }
    case "uri":
      return HOST.test(value.replace(/^\./, ""))
        ? undefined
        : "A host, or a domain with a leading dot: .ncfritz.net";
  }
};

export const CONSTRAINT_TYPES: {
  value: ConstraintType;
  label: string;
  placeholder: string;
}[] = [
  { value: "dns", label: "DNS", placeholder: "internal.ncfritz.net" },
  { value: "ip", label: "IP", placeholder: "192.168.15.0/24" },
  { value: "email", label: "Email", placeholder: "ncfritz.net" },
  { value: "uri", label: "URI", placeholder: ".ncfritz.net" },
];
