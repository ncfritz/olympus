/**
 * An EAB credential's name policy (ADR 0020, ACME): the DNS names its
 * account may request. `exact` names one; `subtree` a name and every name
 * below it. Wildcards are not issued: they need dns-01, which is not
 * offered.
 */
export type NamePolicy = { kind: "exact" | "subtree"; value: string }[];

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** A DNS name as policies and orders hold it: lower case, no trailing dot. */
export const normaliseDnsName = (name: string): string =>
  name.trim().toLowerCase().replace(/\.$/, "");

/** Why a DNS name cannot be in a policy or an order, or undefined. */
export const dnsNameProblem = (name: string): string | undefined => {
  if (name.startsWith("*.")) {
    return `${name}: wildcards need dns-01, which is not offered`;
  }
  if (name.length > 253) return `${name}: longer than 253 characters`;
  const labels = name.split(".");
  if (labels.length < 2) return `${name}: not a fully qualified name`;
  if (!labels.every((label) => LABEL.test(label))) {
    return `${name}: not a DNS name`;
  }
  if (/^\d+$/.test(labels[labels.length - 1])) {
    return `${name}: an IP address, not a DNS name`;
  }
  return undefined;
};

/** Whether the policy lets its account request a name (normalised). */
export const permits = (policy: NamePolicy, name: string): boolean =>
  policy.some((rule) =>
    rule.kind === "exact"
      ? name === rule.value
      : name === rule.value || name.endsWith(`.${rule.value}`),
  );
