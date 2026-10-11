/**
 * A profile version's rules, applied to a request (ADR 0034): pure
 * functions over the rules and what was asked for, each returning what to
 * issue or the problems that refuse it.
 */
import { BlockList, isIP } from "net";
import {
  attributeName,
  attributeOid,
  attributeRank,
  rfc4514Type,
} from "./subjectAttributes";

export type Presence = "required" | "optional" | "excluded";

export type AttributeRule = {
  oid: string;
  presence: Presence;
  defaultValue?: string | null;
  locked: boolean;
  pattern?: string | null;
  maxCount: number;
};

export type SubjectValue = { type: string; value: string };

/** An attribute as the certificate will hold it. */
export type ResolvedAttribute = { oid: string; value: string };

export type Resolved<T> = { value: T; problems: [] } | { problems: string[] };

const escapeValue = (value: string): string =>
  value.replace(/([,+"\\<>;=])/g, "\\$1").replace(/^([ #])/, "\\$1");

/** A DN as RFC 4514 writes it, the last RDN first, for the signer. */
export const subjectString = (attributes: ResolvedAttribute[]): string =>
  [...attributes]
    .sort((a, b) => attributeRank(a.oid) - attributeRank(b.oid))
    .reverse()
    .map((a) => `${rfc4514Type(a.oid)}=${escapeValue(a.value)}`)
    .join(",");

const ORGANIZATION = "2.5.4.10";
const COUNTRY = "2.5.4.6";

/**
 * The subject a request gets: its values checked against the version's
 * rules (presence, locked defaults, patterns, how many), defaults filled
 * in. An organization with no rule-given default is the configured one, as
 * it always was; to leave it out, exclude it.
 */
export const resolveSubject = (
  rules: AttributeRule[],
  given: SubjectValue[],
  organization: string,
): Resolved<ResolvedAttribute[]> => {
  const problems: string[] = [];
  const byOid = new Map(rules.map((r) => [r.oid, r]));
  const values = new Map<string, string[]>();
  for (const { type, value } of given) {
    const oid = attributeOid(type);
    if (!oid) {
      problems.push(`${type} is not a subject attribute`);
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) continue;
    values.set(oid, [...(values.get(oid) ?? []), trimmed]);
  }
  for (const oid of values.keys()) {
    const rule = byOid.get(oid);
    if (!rule || rule.presence === "excluded") {
      problems.push(`the subject may not hold ${attributeName(oid)}`);
    }
  }
  const attributes: ResolvedAttribute[] = [];
  for (const rule of rules) {
    if (rule.presence === "excluded") continue;
    const name = attributeName(rule.oid);
    let list = values.get(rule.oid) ?? [];
    if (rule.locked && rule.defaultValue != null) {
      if (list.some((v) => v !== rule.defaultValue)) {
        problems.push(`${name} is fixed at ${rule.defaultValue}`);
      }
      list = [rule.defaultValue];
    } else if (list.length === 0 && rule.defaultValue) {
      list = [rule.defaultValue];
    } else if (list.length === 0 && rule.oid === ORGANIZATION) {
      list = [organization];
    }
    if (list.length === 0 && rule.presence === "required") {
      problems.push(`the subject needs ${name}`);
    }
    if (list.length > rule.maxCount) {
      problems.push(
        `${name} may take ${rule.maxCount} value${rule.maxCount === 1 ? "" : "s"}, not ${list.length}`,
      );
    }
    for (const value of list) {
      if (rule.pattern && !new RegExp(`^(?:${rule.pattern})$`).test(value)) {
        problems.push(`${name} "${value}" does not match ${rule.pattern}`);
      }
      if (rule.oid === COUNTRY && !/^[A-Z]{2}$/.test(value)) {
        problems.push(`C is a two-letter country code, not "${value}"`);
      }
      attributes.push({ oid: rule.oid, value });
    }
  }
  return problems.length ? { problems } : { value: attributes, problems: [] };
};

export type UsageState = "forced" | "default" | "optional";

/**
 * The usages a certificate gets, of a version's four states (ADR 0034):
 * the forced ones always; then the request's own choice, or else what its
 * CSR (or the certificate it renews) asked for, or else the defaults; never
 * one not listed (excluded). A request asking for an excluded usage is
 * refused; a CSR's is passed over.
 */
export const resolveUsages = (
  states: { name: string; state: UsageState }[],
  requested: string[] | undefined,
  asked: string[] | undefined,
  what: string,
): Resolved<string[]> => {
  const allowed = new Set(states.map((s) => s.name));
  const forced = states.filter((s) => s.state === "forced").map((s) => s.name);
  if (requested) {
    const refused = requested.filter((name) => !allowed.has(name));
    if (refused.length) {
      return {
        problems: [`the profile excludes the ${what} ${refused.join(", ")}`],
      };
    }
    return { value: [...new Set([...forced, ...requested])], problems: [] };
  }
  const chosen = asked
    ? asked.filter((name) => allowed.has(name))
    : states.filter((s) => s.state === "default").map((s) => s.name);
  return { value: [...new Set([...forced, ...chosen])], problems: [] };
};

export type NameRule = { type: string; presence: "allowed" | "required" };
export type NamePolicyRule = {
  type: string;
  kind: "permitted" | "excluded";
  value: string;
};
export type GivenName = { type: string; value: string };

const lower = (s: string) => s.toLowerCase().replace(/\.$/, "");

/**
 * Whether a host lies in a subtree, as RFC 5280 reads one: `example.com`
 * is it and everything under it; `.example.com` only what is under it.
 */
const inDnsSubtree = (host: string, subtree: string): boolean => {
  const name = lower(host);
  const tree = lower(subtree);
  if (tree.startsWith(".")) return name.endsWith(tree);
  return name === tree || name.endsWith(`.${tree}`);
};

const inIpSubtree = (address: string, subtree: string): boolean => {
  const [network, bits] = subtree.split("/");
  const family = isIP(network) === 6 ? "ipv6" : "ipv4";
  if (isIP(address) !== isIP(network)) return false;
  const list = new BlockList();
  list.addSubnet(
    network,
    Number(bits ?? (family === "ipv6" ? 128 : 32)),
    family,
  );
  return list.check(address, family);
};

/** RFC 5280's email subtrees: a mailbox, a host, or `.domain` below it. */
const inEmailSubtree = (address: string, subtree: string): boolean => {
  const mail = address.toLowerCase();
  const tree = subtree.toLowerCase();
  if (tree.includes("@")) return mail === tree;
  const host = mail.slice(mail.lastIndexOf("@") + 1);
  return tree.startsWith(".") ? host.endsWith(tree) : host === tree;
};

/** A URI's host, against a host or a `.domain` subtree. */
const inUriSubtree = (uri: string, subtree: string): boolean => {
  let host: string;
  try {
    host = new URL(uri).hostname;
  } catch {
    return false;
  }
  const tree = lower(subtree);
  return tree.startsWith(".")
    ? lower(host).endsWith(tree)
    : lower(host) === tree;
};

const inSubtree = (type: string, value: string, subtree: string): boolean => {
  switch (type) {
    case "dns":
      return inDnsSubtree(value, subtree);
    case "ip":
      return inIpSubtree(value, subtree);
    case "email":
      return inEmailSubtree(value, subtree);
    case "uri":
      return inUriSubtree(value, subtree);
    default:
      return false;
  }
};

/** Whether a subtree is well formed for its type. */
export const subtreeProblem = (
  type: string,
  value: string,
): string | undefined => {
  if (type === "ip") {
    const [network, bits, extra] = value.split("/");
    const family = isIP(network);
    const max = family === 6 ? 128 : 32;
    if (
      !family ||
      extra !== undefined ||
      bits === undefined ||
      !/^\d+$/.test(bits) ||
      Number(bits) > max
    ) {
      return `${value} is not an IP network (address/prefix)`;
    }
  } else if (!value || /\s/.test(value)) {
    return `"${value}" is not a ${type} subtree`;
  }
  return undefined;
};

/**
 * A request's alternative names against a version's rules: each type
 * allowed, each required type given, enough of them, and every name inside
 * the permitted subtrees of its type (when it has any) and outside the
 * excluded ones.
 */
export const checkNames = (
  rules: NameRule[],
  minNames: number,
  policy: NamePolicyRule[],
  names: GivenName[],
): string[] => {
  const problems: string[] = [];
  const allowed = new Set(rules.map((r) => r.type));
  const refused = [
    ...new Set(names.filter((n) => !allowed.has(n.type)).map((n) => n.type)),
  ];
  if (refused.length) {
    problems.push(`the profile does not allow ${refused.join(", ")} names`);
  }
  for (const rule of rules) {
    if (
      rule.presence === "required" &&
      !names.some((n) => n.type === rule.type)
    ) {
      problems.push(`the profile needs at least one ${rule.type} name`);
    }
  }
  if (names.length < minNames) {
    problems.push(
      `the profile needs at least ${minNames} alternative name${minNames === 1 ? "" : "s"}`,
    );
  }
  for (const name of names) {
    const excluded = policy.filter(
      (p) =>
        p.type === name.type &&
        p.kind === "excluded" &&
        inSubtree(name.type, name.value, p.value),
    );
    if (excluded.length) {
      problems.push(
        `${name.value} is in an excluded subtree (${excluded[0].value})`,
      );
      continue;
    }
    const permitted = policy.filter(
      (p) => p.type === name.type && p.kind === "permitted",
    );
    if (
      permitted.length &&
      !permitted.some((p) => inSubtree(name.type, name.value, p.value))
    ) {
      problems.push(
        `${name.value} is outside the permitted ${name.type} subtrees (${permitted.map((p) => p.value).join(", ")})`,
      );
    }
  }
  return problems;
};

/** A key type against the version's list; an empty list allows any. */
export const keyAlgorithmProblem = (
  allowed: string[],
  algorithm: string,
): string | undefined =>
  allowed.length === 0 || allowed.includes(algorithm)
    ? undefined
    : `the profile allows ${allowed.join(", ")} keys, not ${algorithm}`;

/**
 * A CSR's signature hash against the version's list; an empty list allows
 * any, and a signature with no separate hash (Ed25519) passes.
 */
export const csrHashProblem = (
  allowed: string[],
  hash: string | undefined,
): string | undefined =>
  allowed.length === 0 || hash === undefined || allowed.includes(hash)
    ? undefined
    : `the profile accepts CSRs signed with ${allowed.join(", ")}, not ${hash}`;

/**
 * The extensions Harpocrates builds itself, or a leaf never carries, or
 * it does not offer yet (the TLS feature waits for OCSP): never custom
 * (ADR 0034). The signer refuses the same.
 */
export const MANAGED_EXTENSIONS: Record<string, string> = {
  "2.5.29.14": "subject key identifier",
  "2.5.29.15": "key usage",
  "2.5.29.17": "subject alternative name",
  "2.5.29.18": "issuer alternative name",
  "2.5.29.19": "basic constraints",
  "2.5.29.30": "name constraints",
  "2.5.29.31": "CRL distribution points",
  "2.5.29.32": "certificate policies",
  "2.5.29.33": "policy mappings",
  "2.5.29.35": "authority key identifier",
  "2.5.29.36": "policy constraints",
  "2.5.29.37": "extended key usage",
  "2.5.29.54": "inhibit anyPolicy",
  "1.3.6.1.5.5.7.1.1": "authority information access",
  "1.3.6.1.5.5.7.1.24": "TLS feature",
};

/** Whether bytes are exactly one DER element (definite, minimal lengths). */
export const isOneDerElement = (data: Buffer): boolean => {
  if (data.length < 2 || (data[0] & 0x1f) === 0x1f) return false;
  let start = 2;
  let length = data[1];
  if (length >= 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4 || 2 + count > data.length) return false;
    if (data[2] === 0) return false;
    length = data.subarray(2, 2 + count).readUIntBE(0, count);
    if (length < 0x80) return false;
    start += count;
  }
  return start + length === data.length;
};

/** A custom extension's problem: a managed one, or not one DER element. */
export const customExtensionProblem = (
  oid: string,
  base64: string,
): string | undefined => {
  if (MANAGED_EXTENSIONS[oid]) {
    return `${oid} (${MANAGED_EXTENSIONS[oid]}) is not a custom extension`;
  }
  if (!isOneDerElement(Buffer.from(base64, "base64"))) {
    return `${oid}'s value is not one DER element`;
  }
  return undefined;
};
