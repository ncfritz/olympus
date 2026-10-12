import type { Issuer } from "./api/types";

/** The CAs a CA signed, in the order the service lists them. */
export const childrenOf = (issuers: Issuer[], parentId: string): Issuer[] =>
  issuers.filter((issuer) => issuer.parentId === parentId);

/** Every CA beneath one, depth first. */
export const descendantsOf = (issuers: Issuer[], parentId: string): Issuer[] =>
  childrenOf(issuers, parentId).flatMap((child) => [
    child,
    ...descendantsOf(issuers, child.id),
  ]);

/** The CN of a subject, for a CA's name in a list. */
export const commonName = (subject: string): string =>
  /(?:^|,)CN=((?:\\.|[^,])*)/.exec(subject)?.[1]?.replace(/\\(.)/g, "$1") ??
  subject;

/**
 * A CA's name without its realm, where space is short: "TLS Issuing CA 1 -
 * G1" for "ncfritz.net TLS Issuing CA 1 - G1".
 */
export const shortCaName = (issuer: {
  subject: string;
  organization?: string;
}): string => {
  const name = commonName(issuer.subject);
  const realm = issuer.organization ? `${issuer.organization} ` : "";
  return realm && name.startsWith(realm) ? name.slice(realm.length) : name;
};
