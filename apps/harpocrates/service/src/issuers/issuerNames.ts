/**
 * CA names (ADR 0020, Naming):
 * `CN = <realm> [<purpose>] <tier> CA <n> - G<generation>`, and a slug of
 * the same parts in lower case, used in URLs and metrics.
 */
export type IssuerTierName = "root" | "intermediate" | "issuing";

export type IssuerNameParts = {
  tier: IssuerTierName;
  purpose?: string;
  number: number;
  generation: number;
};

const TIER_WORDS: Record<IssuerTierName, string> = {
  root: "Root",
  intermediate: "Intermediate",
  issuing: "Issuing",
};

/** A CA's common name before its numbering: `<realm> [<purpose>] <tier> CA`. */
export const issuerCommonNameStem = (realm: string, parts: IssuerNameParts) =>
  [realm, parts.purpose, TIER_WORDS[parts.tier], "CA"]
    .filter(Boolean)
    .join(" ");

/** What ends every CA's common name: `<n> - G<generation>`. */
export const issuerNumbering = (parts: IssuerNameParts) =>
  `${parts.number} - G${parts.generation}`;

export const issuerCommonName = (realm: string, parts: IssuerNameParts) =>
  `${issuerCommonNameStem(realm, parts)} ${issuerNumbering(parts)}`;

export const issuerSlug = (parts: IssuerNameParts) =>
  [
    parts.purpose?.toLowerCase().replace(/\s+/g, "-"),
    parts.tier,
    parts.number,
    `g${parts.generation}`,
  ]
    .filter((part) => part !== undefined)
    .join("-");

/**
 * Where an issuer's list and certificate are published, and where its
 * OCSP responder answers: one /ocsp for every CA (ADR 0036).
 */
export const distributionUrls = (base: string, slug: string) => ({
  crlUrl: `${base}/crl/${slug}.crl`,
  caIssuersUrl: `${base}/ca/${slug}.crt`,
  ocspUrl: `${base}/ocsp`,
});
