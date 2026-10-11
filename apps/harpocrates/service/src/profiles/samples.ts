/**
 * A request made up to preview a version (ADR 0034): the least a version's
 * rules accept, so its preview shows the certificate rather than a
 * refusal. What the operator gives instead is used as given.
 */
import type { CertificateNames, NameTypeName } from "../model/common";
import type {
  AttributeRule,
  NamePolicyRule,
  NameRule,
  SubjectValue,
} from "./rules";
import { attributeName } from "./subjectAttributes";

const COMMON_NAME = "2.5.4.3";
const ORGANIZATION = "2.5.4.10";
const COUNTRY = "2.5.4.6";

/** A host inside a DNS subtree, or example.com when there is none. */
const hostIn = (subtree: string | undefined): string =>
  subtree ? `preview.${subtree.replace(/^\./, "")}` : "preview.example.com";

/** The first address of an IP network, past its network address. */
const addressIn = (network: string | undefined): string => {
  if (!network) return "192.0.2.10";
  const [address] = network.split("/");
  if (address.includes(":")) return address.replace(/::?$/, "::a");
  const octets = address.split(".").map(Number);
  octets[3] = Math.min(octets[3] + 10, 254);
  return octets.join(".");
};

const SAMPLES: Record<NameTypeName, (permitted?: string) => string> = {
  dns: hostIn,
  ip: addressIn,
  email: (subtree) =>
    subtree?.includes("@")
      ? subtree
      : `preview@${subtree ? subtree.replace(/^\./, "preview.") : "example.com"}`,
  uri: (subtree) =>
    `https://${subtree ? subtree.replace(/^\./, "preview.") : "preview.example.com"}/`,
  upn: () => "preview@example.com",
  registeredId: () => "1.3.6.1.4.1.55555.1",
};

/**
 * Names the version accepts: one of each required type, then of the
 * allowed types in turn until there are `minNames`, each inside the first
 * permitted subtree of its type.
 */
export const sampleNames = (
  rules: NameRule[],
  minNames: number,
  policy: NamePolicyRule[],
): CertificateNames => {
  const permitted = (type: string) =>
    policy.find((p) => p.type === type && p.kind === "permitted")?.value;
  const names: CertificateNames = {};
  const add = (type: NameTypeName, index: number) => {
    const base = SAMPLES[type](permitted(type));
    const value =
      index === 0
        ? base
        : type === "dns"
          ? base.replace(/^preview/, `preview${index + 1}`)
          : `${base}${index + 1}`;
    names[type] = [...(names[type] ?? []), value];
  };
  const required = rules.filter((r) => r.presence === "required");
  for (const rule of required) add(rule.type as NameTypeName, 0);
  let count = required.length;
  const types = rules.map((r) => r.type as NameTypeName);
  for (let i = 0; count < minNames && types.length; i++, count++) {
    const type = types[i % types.length];
    add(type, names[type]?.length ?? 0);
  }
  return names;
};

/**
 * A subject the version accepts: CN "preview" where it may hold one, and a
 * placeholder for each other required attribute with no default (the
 * organization falls back to the configured one).
 */
export const sampleSubject = (
  rules: AttributeRule[],
): { commonName?: string; attributes: SubjectValue[] } => {
  const listed = (oid: string) =>
    rules.some((r) => r.oid === oid && r.presence !== "excluded");
  const attributes = rules
    .filter(
      (r) =>
        r.presence === "required" &&
        !r.defaultValue &&
        r.oid !== COMMON_NAME &&
        r.oid !== ORGANIZATION,
    )
    .map((r) => ({
      type: attributeName(r.oid),
      value: r.oid === COUNTRY ? "US" : "preview",
    }));
  return {
    ...(listed(COMMON_NAME) ? { commonName: "preview" } : {}),
    attributes,
  };
};
